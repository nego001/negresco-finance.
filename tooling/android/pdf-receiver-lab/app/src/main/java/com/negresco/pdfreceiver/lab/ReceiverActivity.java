package com.negresco.pdfreceiver.lab;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.widget.TextView;

import java.io.File;
import java.io.FileOutputStream;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;

/**
 * Disposable Android lab receiver. Never uploads, logs, renders to a UI,
 * or persists document content. The receipt has metadata only.
 */
public final class ReceiverActivity extends Activity {
  private static final long MAX_BYTES = 8L * 1024L * 1024L;
  private static final String RECEIPT = "receipt.json";
  // One-shot private marker set ONLY by adb run-as in disposable CI emulators.
  // A shared ACTION_SEND Intent can never enable this lab-only capture.
  private static final String CAPTURE_MARKER = "allow-synthetic-text-check-once";
  private static final String CAPTURE_FILE = "captured-synthetic-report.pdf";

  @Override public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    TextView label = new TextView(this);
    label.setText("Negresco PDF Receiver LAB");
    setContentView(label);
    // PDF parsing/rendering is not UI work. Keep Activity launch responsive on
    // Android 8/9 and complete the diagnostic receipt on a worker thread.
    Thread worker = new Thread(this::receiveAndRender, "pdf-receiver-lab");
    worker.setDaemon(true);
    worker.start();
  }

  private void receiveAndRender() {
    File temp = null;
    String receipt = null;
    boolean captured = false;
    try {
      Intent intent = getIntent();
      if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) {
        throw new IllegalStateException("not a share intent");
      }
      if (!"application/pdf".equals(intent.getType())) {
        throw new IllegalStateException("wrong MIME type");
      }
      @SuppressWarnings("deprecation")
      Uri uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
      if (uri == null || !"content".equals(uri.getScheme())) {
        throw new IllegalStateException("not a content URI");
      }
      if ((intent.getFlags() & Intent.FLAG_GRANT_READ_URI_PERMISSION) == 0) {
        throw new IllegalStateException("no temporary URI permission");
      }
      temp = File.createTempFile("received-", ".pdf", getCacheDir());
      MessageDigest hash = MessageDigest.getInstance("SHA-256");
      long size = 0;
      try (InputStream stream = getContentResolver().openInputStream(uri);
           FileOutputStream output = new FileOutputStream(temp)) {
        if (stream == null) throw new IllegalStateException("unreadable content stream");
        byte[] chunk = new byte[16 * 1024];
        int n;
        while ((n = stream.read(chunk)) != -1) {
          size += n;
          if (size > MAX_BYTES) throw new IllegalStateException("oversized PDF");
          output.write(chunk, 0, n);
          hash.update(chunk, 0, n);
        }
        output.getFD().sync();
      }
      if (size < 200) throw new IllegalStateException("PDF too small");
      if (!isPdfWithEof(temp)) throw new IllegalStateException("bad PDF boundaries");

      int pages;
      int verifiedPages = 0;
      try (ParcelFileDescriptor fd = ParcelFileDescriptor.open(
               temp, ParcelFileDescriptor.MODE_READ_ONLY);
           PdfRenderer renderer = new PdfRenderer(fd)) {
        pages = renderer.getPageCount();
        if (pages < 1 || pages > 100) throw new IllegalStateException("invalid page count");
        // Render EVERY page. A decodable file with a blank/unrenderable later page
        // must not count as a complete PDF. Never persist or share bitmap pixels.
        for (int index = 0; index < pages; index++) {
          try (PdfRenderer.Page page = renderer.openPage(index)) {
            if (page.getWidth() <= 0 || page.getHeight() <= 0) {
              throw new IllegalStateException("invalid page dimensions");
            }
            Bitmap bmp = Bitmap.createBitmap(384, 384, Bitmap.Config.ARGB_8888);
            try {
              bmp.eraseColor(Color.WHITE);
              page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
              if (!hasVisibleInk(bmp)) {
                throw new BlankPageException(index);
              }
              verifiedPages++;
            } finally {
              bmp.recycle();
            }
          }
        }
      }
      if (verifiedPages != pages) throw new IllegalStateException("partial render");
      // Default mode never retains PDFs. Controlled CI can opt in, once,
      // with a marker inside this disposable receiver's private files dir.
      File marker = new File(getFilesDir(), CAPTURE_MARKER);
      if (marker.isFile()) {
        if (!marker.delete()) throw new IllegalStateException("cannot consume synthetic marker");
        File snapshot = new File(getFilesDir(), CAPTURE_FILE);
        if (snapshot.exists()) throw new IllegalStateException("stale synthetic snapshot");
        try (FileInputStream input = new FileInputStream(temp);
             FileOutputStream output = new FileOutputStream(snapshot)) {
          byte[] buffer = new byte[16 * 1024];
          int read;
          while ((read = input.read(buffer)) != -1) {
            output.write(buffer, 0, read);
          }
          output.getFD().sync();
          if (snapshot.length() != size) throw new IllegalStateException("snapshot size mismatch");
          captured = true;
        } catch (Exception failure) {
          // A partial copy is never a report; no content is logged.
          if (snapshot.exists()) snapshot.delete();
          throw failure;
        }
      }
      // The SHA identifies test bytes; no document bytes, URI, or PII are logged.
      receipt = ("{\"schemaVersion\":1,\"status\":\"received-rendered\","
          + "\"contentUriGranted\":true,\"pdfHeaderAndEof\":true,"
          + "\"renderedFirstPage\":true,\"allPagesRendered\":true,\"nonblankPages\":" + verifiedPages
          + ",\"pages\":" + pages
          + ",\"bytes\":" + size + ",\"syntheticTextCapture\":" + captured
          + ",\"sha256\":\"" + hex(hash.digest())
          + "\",\"syntheticOnly\":true,\"stableReleaseAllowed\":false}");
    } catch (BlankPageException blank) {
      // Fixed failure category and page index only; never expose any PDF content.
      receipt = ("{\"schemaVersion\":1,\"status\":\"blocked\",\"reason\":\"blank-page\","
          + "\"rejectedPageIndex\":" + blank.pageIndex
          + ",\"syntheticOnly\":true,\"stableReleaseAllowed\":false}");
    } catch (Exception ignored) {
      // No raw exceptions, URI, filenames, source HTML or document contents.
      receipt = ("{\"schemaVersion\":1,\"status\":\"blocked\","
          + "\"syntheticOnly\":true,\"stableReleaseAllowed\":false}");
    } finally {
      // Publish no success receipt until the private PDF has been removed.
      // A failed deletion must never be reported as a completed render.
      boolean cacheClean = temp == null || temp.delete() || !temp.exists();
      if (!cacheClean) {
        receipt = "{\"schemaVersion\":1,\"status\":\"blocked\","
            + "\"reason\":\"cache-cleanup-failed\","
            + "\"syntheticOnly\":true,\"stableReleaseAllowed\":false}";
      }
      if (receipt == null) {
        receipt = "{\"schemaVersion\":1,\"status\":\"blocked\","
            + "\"syntheticOnly\":true,\"stableReleaseAllowed\":false}";
      }
      writeReceipt(receipt);
      runOnUiThread(this::finish);
    }
  }

  private static final class BlankPageException extends Exception {
    final int pageIndex;
    BlankPageException(int pageIndex) { this.pageIndex = pageIndex; }
  }

  private static boolean hasVisibleInk(Bitmap bmp) {
    // Pixel content is inspected in memory only, never recorded.
    // Require both light paper and actual dark ink, not merely PDF syntax.
    int dark = 0;
    int light = 0;
    for (int y = 0; y < bmp.getHeight(); y++) {
      for (int x = 0; x < bmp.getWidth(); x++) {
        int color = bmp.getPixel(x, y);
        int luminance = (Color.red(color) + Color.green(color) + Color.blue(color)) / 3;
        if (luminance < 205) dark++;
        if (luminance > 245) light++;
        if (dark >= 12 && light >= 12) return true;
      }
    }
    return false;
  }

  private static boolean isPdfWithEof(File file) throws Exception {
    try (RandomAccessFile in = new RandomAccessFile(file, "r")) {
      byte[] header = new byte[5];
      in.readFully(header);
      if (!"%PDF-".equals(new String(header, StandardCharsets.US_ASCII))) {
        return false;
      }
      int count = (int)Math.min(in.length(), 1024);
      byte[] tail = new byte[count];
      in.seek(in.length() - count);
      in.readFully(tail);
      return new String(tail, StandardCharsets.ISO_8859_1).contains("%%EOF");
    }
  }

  private static String hex(byte[] digest) {
    StringBuilder value = new StringBuilder(digest.length * 2);
    for (byte b : digest) value.append(String.format(Locale.ROOT, "%02x", b & 255));
    return value.toString();
  }

  private void writeReceipt(String metadataOnly) {
    try (FileOutputStream out = openFileOutput(RECEIPT, MODE_PRIVATE)) {
      out.write(metadataOnly.getBytes(StandardCharsets.UTF_8));
      out.getFD().sync();
    } catch (Exception ignored) {
      // Missing receipt MUST cause the outer runner to fail closed.
    }
  }
}
