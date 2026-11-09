// SSAdesk — janela das telas de instalação (host leve com WebView2, já presente no Windows 11).
// Abre em ~1-2 s com as MESMAS telas glass do app (setup.html), enquanto o pacote pesado é extraído
// em segundo plano. A instalação em si roda no motor do app (SSAdesk.exe em modo Node + instalar-cli.js).
//
// Uso: SetupUI.exe <pastaUI> <pastaPacote> <versao>
// Sinais para o envelope (Setup.exe): vivo.flag (a cada 2 s), fim.flag (ao fechar), ui-falhou.flag (sem WebView2).
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using Microsoft.Win32;

static class Program
{
    [STAThread]
    static int Main(string[] args)
    {
        if (args.Length < 3) return 2;
        Application.EnableVisualStyles();
        var form = new JanelaSetup(args[0], args[1], args[2]);
        Application.Run(form);
        return form.Falhou ? 3 : 0;
    }
}

class JanelaSetup : Form
{
    [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr h, int attr, ref int v, int size);
    [StructLayout(LayoutKind.Sequential)] struct Margens { public int a, b, c, d; }
    [DllImport("dwmapi.dll")] static extern int DwmExtendFrameIntoClientArea(IntPtr h, ref Margens m);

    readonly string ui, pkg, versao;
    readonly WebView2 web = new WebView2();
    readonly JavaScriptSerializer json = new JavaScriptSerializer();
    readonly Timer vivo = new Timer();
    public bool Falhou;
    string exeInstalado;
    bool ocupado;

    static readonly string[] Passos = { "Removendo versão anterior", "Copiando arquivos", "Configurando acesso remoto", "Abrindo túnel seguro", "Analisando a rede", "Finalizando" };

    public JanelaSetup(string ui, string pkg, string versao)
    {
        this.ui = ui; this.pkg = pkg; this.versao = versao;
        Text = "SSAdesk";
        ClientSize = new Size(400, 548);
        FormBorderStyle = FormBorderStyle.None;
        StartPosition = FormStartPosition.CenterScreen;
        // Abre na frente de tudo (sem isso podia ficar atrás da janela do Explorador)
        Shown += (s, e) => { TopMost = true; Activate(); BringToFront(); TopMost = false; };
        bool escuro = TemaEscuro();
        BackColor = escuro ? Color.FromArgb(28, 28, 30) : Color.FromArgb(242, 242, 247);
        try { Icon = new Icon(Path.Combine(ui, "ssadesk.ico")); } catch { }
        web.Dock = DockStyle.Fill;
        web.DefaultBackgroundColor = BackColor;
        Controls.Add(web);

        vivo.Interval = 2000;
        vivo.Tick += (s, e) => Marca("vivo.flag");
        Marca("vivo.flag"); vivo.Start();
        FormClosing += (s, e) => { if (ocupado) e.Cancel = true; };
        FormClosed += (s, e) => Marca("fim.flag");
        Shown += async (s, e) => await Iniciar();
    }

    protected override CreateParams CreateParams
    {
        get { var cp = base.CreateParams; cp.ClassStyle |= 0x20000; /* sombra */ cp.Style |= 0x00020000; /* minimizar pela barra de tarefas */ return cp; }
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        int canto = 2; DwmSetWindowAttribute(Handle, 33, ref canto, 4);           // cantos arredondados (Windows 11)
        int escuro = TemaEscuro() ? 1 : 0; DwmSetWindowAttribute(Handle, 20, ref escuro, 4);
        var m = new Margens { a = 1, b = 1, c = 1, d = 1 }; DwmExtendFrameIntoClientArea(Handle, ref m); // sombra suave
    }

    static bool TemaEscuro()
    {
        try { var v = Registry.GetValue(@"HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize", "AppsUseLightTheme", 1); return v is int && (int)v == 0; }
        catch { return false; }
    }

    void Marca(string nome) { try { File.WriteAllText(Path.Combine(pkg, nome), DateTime.Now.Ticks.ToString()); } catch { } }

    async Task Iniciar()
    {
        try
        {
            var env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(Path.GetTempPath(), "ssadesk-setup-wv2"));
            await web.EnsureCoreWebView2Async(env);
        }
        catch
        {
            // Sem WebView2: o envelope abre as telas pelo app (plano B)
            Falhou = true; Marca("ui-falhou.flag"); Close(); return;
        }
        var cw = web.CoreWebView2;
        cw.Settings.AreDevToolsEnabled = false;
        cw.Settings.AreDefaultContextMenusEnabled = false;
        cw.Settings.IsStatusBarEnabled = false;
        cw.Settings.IsZoomControlEnabled = false;
        try { cw.Settings.IsNonClientRegionSupportEnabled = true; } catch { } // CSS app-region: drag (arrastar a janela)
        cw.WebMessageReceived += Mensagem;
        cw.Navigate(new Uri(Path.Combine(ui, "src", "setup.html")).AbsoluteUri + "?platform=win32&ponte=webview");
    }

    void Responder(object id, object resultado) { Postar(new Dictionary<string, object> { { "id", id }, { "resultado", resultado } }); }
    void Postar(object obj) { if (InvokeRequired) { BeginInvoke(new Action(() => Postar(obj))); return; } web.CoreWebView2.PostWebMessageAsJson(json.Serialize(obj)); }

    async void Mensagem(object s, CoreWebView2WebMessageReceivedEventArgs e)
    {
        Dictionary<string, object> m;
        try { m = json.Deserialize<Dictionary<string, object>>(e.WebMessageAsJson); } catch { return; }
        object id = m.ContainsKey("id") ? m["id"] : null;
        string acao = m.ContainsKey("acao") ? Convert.ToString(m["acao"]) : "";
        object dados = m.ContainsKey("dados") ? m["dados"] : null;

        switch (acao)
        {
            case "janela":
                if (Convert.ToString(dados) == "minimizar") WindowState = FormWindowState.Minimized;
                if (Convert.ToString(dados) == "fechar" && !ocupado) Close();
                break;
            case "info":
                Responder(id, new Dictionary<string, object> { { "modo", "instalar" }, { "versao", versao }, { "destino", DestinoPadrao() }, { "passos", Passos }, { "existente", JaInstalado() } });
                break;
            case "pasta":
                using (var d = new FolderBrowserDialog { Description = "Onde instalar o SSAdesk", ShowNewFolderButton = true })
                {
                    Responder(id, d.ShowDialog(this) == DialogResult.OK ? PastaFinal(d.SelectedPath) : null);
                }
                break;
            case "instalar":
                ocupado = true;
                var dd = dados as Dictionary<string, object>;
                var r = await Instalar(Convert.ToString(dd["destino"]), Convert.ToString(dd["senha"]), dd.ContainsKey("manterSenha") && Convert.ToBoolean(dd["manterSenha"]));
                ocupado = false;
                Responder(id, r);
                break;
            case "abrir":
                if (exeInstalado != null && File.Exists(exeInstalado))
                    Process.Start(new ProcessStartInfo("explorer.exe", "\"" + exeInstalado + "\"") { UseShellExecute = false }); // abre como usuário normal
                Responder(id, true);
                BeginInvoke(new Action(Close));
                break;
        }
    }

    static string PastaFinal(string escolhida)
    {
        var p = Path.GetFullPath(string.IsNullOrEmpty(escolhida) ? @"C:\SSAdesk" : escolhida).TrimEnd('\\');
        if (p.Length <= 3) p = p.TrimEnd('\\') + "\\";
        return Path.GetFileName(p.TrimEnd('\\')).Equals("SSAdesk", StringComparison.OrdinalIgnoreCase) ? p : Path.Combine(p, "SSAdesk");
    }

    static bool JaInstalado()
    {
        try { var v = Registry.GetValue(@"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\SSAdesk", "InstallLocation", null) as string; return !string.IsNullOrEmpty(v) && Directory.Exists(v); }
        catch { return false; }
    }

    static string DestinoPadrao()
    {
        try
        {
            var v = Registry.GetValue(@"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\SSAdesk", "InstallLocation", null) as string;
            if (!string.IsNullOrEmpty(v) && Directory.Exists(v)) return v;
        }
        catch { }
        return @"C:\SSAdesk";
    }

    // Roda o motor de instalação (instalador.js) no SSAdesk.exe em modo Node, lendo o progresso linha a linha
    Task<object> Instalar(string destino, string senha, bool manterSenha)
    {
        var tcs = new TaskCompletionSource<object>();
        Task.Run(() =>
        {
            try
            {
                // O resto do pacote ainda pode estar sendo extraído pelo envelope
                for (int i = 0; i < 1200 && !File.Exists(Path.Combine(pkg, "pronto.flag")); i++) System.Threading.Thread.Sleep(200);
                var psi = new ProcessStartInfo(Path.Combine(pkg, "app", "SSAdeskApp.exe"),
                    "\"" + Path.Combine(pkg, "app", "resources", "app", "instalar-cli.js") + "\"")
                {
                    UseShellExecute = false, CreateNoWindow = true,
                    RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true,
                    StandardOutputEncoding = Encoding.UTF8
                };
                psi.EnvironmentVariables["ELECTRON_RUN_AS_NODE"] = "1";
                object resultado = null;
                using (var p = Process.Start(psi))
                {
                    var entrada = json.Serialize(new Dictionary<string, object> { { "payload", pkg }, { "destino", destino }, { "senha", senha }, { "versao", versao }, { "manterSenha", manterSenha } });
                    var w = new StreamWriter(p.StandardInput.BaseStream, new UTF8Encoding(false));
                    w.Write(entrada); w.Close();
                    string linha;
                    while ((linha = p.StandardOutput.ReadLine()) != null)
                    {
                        Dictionary<string, object> ev;
                        try { ev = json.Deserialize<Dictionary<string, object>>(linha); } catch { continue; }
                        if (ev.ContainsKey("passo")) Postar(new Dictionary<string, object> { { "evento", "passo" }, { "valor", ev["passo"] } });
                        if (ev.ContainsKey("ok")) { resultado = ev; if (ev.ContainsKey("exe")) exeInstalado = Convert.ToString(ev["exe"]); }
                    }
                    p.WaitForExit();
                }
                tcs.SetResult(resultado ?? new Dictionary<string, object> { { "ok", false }, { "msg", "A instalação foi interrompida." } });
            }
            catch (Exception ex) { tcs.SetResult(new Dictionary<string, object> { { "ok", false }, { "msg", ex.Message } }); }
        });
        return tcs.Task;
    }
}
