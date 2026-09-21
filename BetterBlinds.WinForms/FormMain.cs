using System.Diagnostics;

namespace BetterBlinds.WinForms;

public partial class FormMain : Form
{
    private readonly Microsoft.Web.WebView2.WinForms.WebView2 webView = new();
    private Process? backendProcess;

    public FormMain()
    {
        InitializeComponent();
        Load += async (_, _) => await OnLoadAsync();
        FormClosing += (_, _) => ShutdownBackend();
    }

    private async Task OnLoadAsync()
    {
        StartBackendHidden();

        webView.Dock = DockStyle.Fill;
        Controls.Add(webView);

        // Point WebView2 at the Vite dev server during development,
        // or at the bundled dist/index.html after `npm run build`.
        // The dev server is preferred when it is running (hot reload).
        var devUrl = "http://localhost:5173";
        var distIndex = Path.Combine(AppContext.BaseDirectory, "dist", "index.html");

        await webView.EnsureCoreWebView2Async();

        // Lock down the demo surface: no devtools, no context menu.
        webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
        webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;

        if (await IsReachableAsync(devUrl))
            webView.CoreWebView2.Navigate(devUrl);
        else if (File.Exists(distIndex))
            webView.CoreWebView2.Navigate(new Uri(distIndex).AbsoluteUri);
        else
            webView.CoreWebView2.NavigateToString(
                "<html><body style='font-family:monospace;padding:32px'><h2>Backend not reachable</h2>" +
                "<p>Start the backend: <code>python -m flask --app backend/app run --port 5000</code><br>" +
                "Or run the dev server: <code>npm run dev --prefix frontend</code></p>" +
                "<p>After building, <code>npm run build --prefix frontend</code> also lets this exe run offline from <code>dist/index.html</code>.</p></body></html>");
    }

    private void StartBackendHidden()
    {
        // Try to launch Flask hidden. If python/flask isn't on PATH on the demo
        // machine, the WebView2 fallback page above will explain. No console
        // window is shown — the backend runs silently.
        var repoRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", ".."));
        var backendExe = Path.Combine(repoRoot, "backend-dist", "backend.exe");

        try
        {
            if (File.Exists(backendExe))
            {
                backendProcess = Process.Start(new ProcessStartInfo
                {
                    FileName = backendExe,
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    WindowStyle = ProcessWindowStyle.Hidden,
                });
                return;
            }

            // Fallback: python -m flask (requires Python + Flask on PATH).
            // We try `python` then `py` — whichever exists.
            foreach (var python in new[] { "python", "py" })
            {
                try
                {
                    backendProcess = Process.Start(new ProcessStartInfo
                    {
                        FileName = python,
                        Arguments = "-m flask --app backend/app run --port 5000",
                        WorkingDirectory = repoRoot,
                        CreateNoWindow = true,
                        UseShellExecute = false,
                        WindowStyle = ProcessWindowStyle.Hidden,
                    });
                    // If we got here without throwing, assume it launched.
                    if (backendProcess is not null) break;
                }
                catch { /* try next python */ }
            }
        }
        catch
        {
            // Non-fatal: the explanatory page will show.
        }
    }

    private void ShutdownBackend()
    {
        try
        {
            if (backendProcess is not null && !backendProcess.HasExited)
            {
                backendProcess.Kill(entireProcessTree: true);
                backendProcess.Dispose();
            }
        }
        catch { }
    }

    private static async Task<bool> IsReachableAsync(string url)
    {
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromMilliseconds(400) };
            var resp = await client.GetAsync(url);
            return resp.IsSuccessStatusCode;
        }
        catch { return false; }
    }
}
