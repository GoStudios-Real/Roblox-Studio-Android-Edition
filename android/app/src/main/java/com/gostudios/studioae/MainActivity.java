package com.gostudios.studioae;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Roblox Studio Android Edition — WebView host.
 *
 * Loads the shared web build from assets and exposes `AndroidBridge`
 * (wrapped as NativeBridge in js/main.js) so the app can talk to
 * Roblox APIs without CORS, open the OAuth flow in the system browser,
 * receive the robloxstudioae://auth deep link and save exported files.
 */
public class MainActivity extends Activity {

    private static final String TAG = "StudioAE";
    private static final String APP_URL = "file:///android_asset/docs/index.html";
    static final String VERSION_NAME = "1.0.0";

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (Build.VERSION.SDK_INT >= 26) {
            s.setSafeBrowsingEnabled(false);
        }

        web.setBackgroundColor(0xFF0F1115);
        web.addJavascriptInterface(new Bridge(this), "AndroidBridge");

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onConsoleMessage(String message, int lineNumber, String sourceId) {
                Log.d(TAG, sourceId + ":" + lineNumber + " " + message);
            }
        });

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                String scheme = u.getScheme() == null ? "" : u.getScheme().toLowerCase();
                if ("http".equals(scheme) || "https".equals(scheme)) {
                    // Any real web navigation (e.g. the OAuth authorize page)
                    // happens in the system browser, never inside the WebView.
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, u));
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "No browser found", Toast.LENGTH_SHORT).show();
                    }
                    return true;
                }
                return false;
            }
        });

        loadApp(intentUriQuery(getIntent()));
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        loadApp(intentUriQuery(intent));
    }

    private static String intentUriQuery(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data == null) return null;
        if (!"robloxstudioae".equalsIgnoreCase(data.getScheme())) return null;
        String q = data.getEncodedQuery();
        return (q == null || q.isEmpty()) ? null : q;
    }

    private void loadApp(String query) {
        String url = APP_URL + (query != null ? "?" + query : "");
        web.loadUrl(url);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    /* ------------------------------------------------------------------ */
    /*  Native bridge exposed to JavaScript as `AndroidBridge`             */
    /* ------------------------------------------------------------------ */
    public static class Bridge {

        private final Activity activity;

        Bridge(Activity activity) {
            this.activity = activity;
        }

        /** HTTP call without CORS limits. Returns {"status":N,"body":"..."} or {"error":"..."} */
        @JavascriptInterface
        public String fetch(String url, String optsJson) {
            final JSONObject result = new JSONObject();
            final CountDownLatch latch = new CountDownLatch(1);
            new Thread(() -> {
                HttpURLConnection conn = null;
                try {
                    JSONObject opts = new JSONObject(
                            optsJson == null || optsJson.isEmpty() ? "{}" : optsJson);
                    String method = opts.optString("method", "GET").toUpperCase();
                    conn = (HttpURLConnection) new URL(url).openConnection();
                    conn.setRequestMethod(method);
                    conn.setConnectTimeout(20000);
                    conn.setReadTimeout(45000);
                    conn.setInstanceFollowRedirects(true);

                    JSONObject headers = opts.optJSONObject("headers");
                    if (headers != null) {
                        Iterator<String> it = headers.keys();
                        while (it.hasNext()) {
                            String k = it.next();
                            conn.setRequestProperty(k, headers.optString(k));
                        }
                    }

                    String body = opts.isNull("body") ? null : opts.optString("body", null);
                    if (body != null && body.length() > 0
                            && !"GET".equals(method) && !"HEAD".equals(method)) {
                        conn.setDoOutput(true);
                        OutputStream os = conn.getOutputStream();
                        os.write(body.getBytes(StandardCharsets.UTF_8));
                        os.close();
                    }

                    int status = conn.getResponseCode();
                    InputStream in = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
                    String text = in == null ? "" : readAll(in);
                    if (in != null) in.close();

                    result.put("status", status);
                    result.put("body", text);
                } catch (Exception e) {
                    try {
                        result.put("error", String.valueOf(e));
                    } catch (Exception ignored) {
                    }
                } finally {
                    if (conn != null) conn.disconnect();
                    latch.countDown();
                }
            }, "bridge-fetch").start();

            try {
                latch.await(70, TimeUnit.SECONDS);
            } catch (InterruptedException ignored) {
            }
            return result.toString();
        }

        /** Open a URL in the system browser (used for the OAuth sign-in flow). */
        @JavascriptInterface
        public void openUrl(final String url) {
            activity.runOnUiThread(() -> {
                try {
                    activity.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (Exception e) {
                    Toast.makeText(activity, "Could not open link", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public String appInfo() {
            JSONObject o = new JSONObject();
            try {
                o.put("native", true);
                o.put("app", "Roblox Studio Android Edition");
                o.put("version", VERSION_NAME);
                o.put("sdk", Build.VERSION.SDK_INT);
            } catch (Exception ignored) {
            }
            return o.toString();
        }

        @JavascriptInterface
        public void share(final String text) {
            activity.runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("text/plain");
                i.putExtra(Intent.EXTRA_TEXT, text == null ? "" : text);
                activity.startActivity(Intent.createChooser(i, "Share"));
            });
        }

        /** Save a text file (rbxlx export etc). Returns true when written. */
        @JavascriptInterface
        public String saveFile(String name, String content) {
            try {
                String safe = (name == null || name.isEmpty()) ? "place.rbxlx" : name;
                byte[] data = (content == null ? "" : content).getBytes(StandardCharsets.UTF_8);
                boolean ok;
                String where;
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentResolver cr = activity.getContentResolver();
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.Downloads.DISPLAY_NAME, safe);
                    cv.put(MediaStore.Downloads.MIME_TYPE, guessMime(safe));
                    cv.put(MediaStore.Downloads.IS_PENDING, 1);
                    Uri uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                    if (uri == null) throw new IOException("insert failed");
                    OutputStream os = cr.openOutputStream(uri);
                    if (os == null) throw new IOException("open failed");
                    os.write(data);
                    os.close();
                    cv.clear();
                    cv.put(MediaStore.Downloads.IS_PENDING, 0);
                    cr.update(uri, cv, null, null);
                    ok = true;
                    where = "Downloads/" + safe;
                } else {
                    File dir = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    if (dir == null) dir = activity.getFilesDir();
                    File f = new File(dir, safe);
                    FileOutputStream fos = new FileOutputStream(f);
                    fos.write(data);
                    fos.close();
                    ok = true;
                    where = f.getAbsolutePath();
                }
                final String msg = ok ? "Saved " + where : "Save failed";
                activity.runOnUiThread(() ->
                        Toast.makeText(activity, msg, Toast.LENGTH_LONG).show());
                return "ok:" + where;
            } catch (Exception e) {
                final String err = "error:" + e;
                activity.runOnUiThread(() ->
                        Toast.makeText(activity, "Save failed: " + e, Toast.LENGTH_LONG).show());
                return err;
            }
        }

        private static String guessMime(String name) {
            String n = name.toLowerCase();
            if (n.endsWith(".json")) return "application/json";
            if (n.endsWith(".xml")) return "application/xml";
            if (n.endsWith(".png")) return "image/png";
            if (n.endsWith(".lua") || n.endsWith(".luau")) return "text/x-lua";
            return "application/octet-stream";
        }

        private static String readAll(InputStream in) throws IOException {
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) != -1) bos.write(buf, 0, n);
            return bos.toString("UTF-8");
        }
    }
}
