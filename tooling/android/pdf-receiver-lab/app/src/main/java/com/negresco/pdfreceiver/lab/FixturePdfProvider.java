package com.negresco.pdfreceiver.lab;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.pdf.PdfDocument;
import android.net.Uri;
import android.os.ParcelFileDescriptor;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.OutputStream;

/**
 * Private, fixture-only streaming provider used by the disposable receiver lab.
 * No disk PDF, network, personal data, or exported content-provider surface.
 * It intentionally does NOT prove third-party URI grant interoperability.
 */
public final class FixturePdfProvider extends ContentProvider {
  public static final String AUTHORITY = "com.negresco.pdfreceiver.lab.fixtures";

  @Override public boolean onCreate() { return true; }

  private static boolean allowed(Uri uri) {
    if (uri == null || !AUTHORITY.equals(uri.getAuthority()) ||
        !"content".equals(uri.getScheme()) || uri.getQuery() != null ||
        uri.getFragment() != null) return false;
    return "/nonblank-3".equals(uri.getPath()) ||
           "/blank-middle-3".equals(uri.getPath());
  }

  @Override public String getType(Uri uri) {
    return allowed(uri) ? "application/pdf" : null;
  }

  @Override public ParcelFileDescriptor openFile(Uri uri, String mode)
      throws FileNotFoundException {
    if (!allowed(uri) || !"r".equals(mode)) {
      throw new FileNotFoundException("unsupported synthetic fixture");
    }
    final boolean blankMiddle = "/blank-middle-3".equals(uri.getPath());
    try {
      final ParcelFileDescriptor[] pipe = ParcelFileDescriptor.createPipe();
      Thread producer = new Thread(() -> {
        try (OutputStream out = new ParcelFileDescriptor.AutoCloseOutputStream(pipe[1])) {
          // Android PdfDocument implements neither AutoCloseable nor Closeable.
          PdfDocument document = new PdfDocument();
          try {
            for (int n = 1; n <= 3; n++) {
            PdfDocument.PageInfo info = new PdfDocument.PageInfo.Builder(600, 800, n).create();
            PdfDocument.Page page = document.startPage(info);
            Canvas canvas = page.getCanvas();
            canvas.drawColor(Color.WHITE);
            if (!(blankMiddle && n == 2)) {
              Paint ink = new Paint();
              ink.setColor(Color.BLACK);
              ink.setStyle(Paint.Style.FILL);
              canvas.drawRect(65, 80, 470, 135, ink);
              ink.setTextSize(32);
              canvas.drawText("LAB ONLY PAGE " + n, 70, 220, ink);
            }
            document.finishPage(page);
          }
            document.writeTo(out);
          } finally {
            document.close();
          }
        } catch (IOException | RuntimeException ignored) {
          // Receiver will reject missing or truncated input. No exception content logged.
        }
      }, "synthetic-pdf-fixture");
      producer.setDaemon(true);
      producer.start();
      return pipe[0];
    } catch (IOException failure) {
      throw new FileNotFoundException("fixture pipe unavailable");
    }
  }

  @Override public Cursor query(Uri uri, String[] projection, String selection,
                                String[] selectionArgs, String sortOrder) { return null; }
  @Override public Uri insert(Uri uri, ContentValues values) { return null; }
  @Override public int delete(Uri uri, String selection, String[] selectionArgs) { return 0; }
  @Override public int update(Uri uri, ContentValues values, String selection,
                              String[] selectionArgs) { return 0; }
}
