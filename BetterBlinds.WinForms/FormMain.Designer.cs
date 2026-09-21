#nullable disable
namespace BetterBlinds.WinForms;

partial class FormMain
{
    private System.ComponentModel.IContainer? components = null;

    protected override void Dispose(bool disposing)
    {
        if (disposing) components?.Dispose();
        base.Dispose(disposing);
    }

    private void InitializeComponent()
    {
        SuspendLayout();
        AutoScaleMode = AutoScaleMode.Font;
        ClientSize = new System.Drawing.Size(1280, 800);
        MinimumSize = new System.Drawing.Size(1024, 600);
        StartPosition = FormStartPosition.CenterScreen;
        Text = "BetterBlinds Fuzzy Simulator";
        ResumeLayout(false);
    }
}
