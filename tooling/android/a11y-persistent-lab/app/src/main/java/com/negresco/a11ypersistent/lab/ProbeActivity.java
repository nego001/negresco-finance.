package com.negresco.a11ypersistent.lab;
import android.app.Activity;
import android.os.Bundle;
import android.widget.TextView;
public final class ProbeActivity extends Activity {
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    TextView label = new TextView(this);
    label.setText("Synthetic accessibility reference");
    setContentView(label);
  }
}
