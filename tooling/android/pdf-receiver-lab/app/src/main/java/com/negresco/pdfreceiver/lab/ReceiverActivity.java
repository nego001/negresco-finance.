package com.negresco.pdfreceiver.lab;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.widget.TextView;

import java.io.File;
import java.io.FileOutputStream;
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

  @Override public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    TextView label = new TextView(this);
    label.setText("Negresco PDF Receiver LAB");
    setContentView(label);
    File temp = null;
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
      try (ParcelFileDescriptor fd = ParcelFileDescriptor.open(
               temp, ParcelFileDescriptor.MODE_READ_ONLY);
           PdfRenderer renderer = new PdfRenderer(fd)) {
        pages = renderer.getPageCount();
        if (pages < 1 || pages > 100) throw new IllegalStateException("invalid page count");
        try (PdfRenderer.Page first = renderer.openPage(0)) {
          Bitmap bmp = Bitmap.createBitmap(96, 96, Bitmap.Config.ARGB_8888);
          try {
            first.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
          } finally {
            bmp.recycle();
          }
        }
      }
      // The SHA identifies test bytes; no document bytes, URI, or PII are logged.
      writeReceipt("{\"schemaVersion\":1,\"status\":\"received-rendered\","
          + "\"contentUriGranted\":true,\"pdfHeaderAndEof\":true,"
          + "\"renderedFirstPage\":true,\"pages\":" + pages
          + ",\"bytes\":" + size + ",\"sha256\":\"" + hex(hash.digest())
          + "\",\"syntheticOnly\":true,\"stableReleaseAllowed\":false}");
    } catch (Exception ignored) {
      // No raw exceptions, URI, filenames, source HTML or document contents.
      writeReceipt("{\"schemaVersion\":1,\"status\":\"blocked\","
          + "\"syntheticOnly\":true,\"stableReleaseAllowed\":false}");
    } finally {
      if (temp != null) temp.delete();
      finish();
    }
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
