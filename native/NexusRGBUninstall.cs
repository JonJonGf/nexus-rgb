using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Text.RegularExpressions;
using System.Windows.Forms;
using Microsoft.Win32;

internal static class NexusRGBUninstall {
    private const string RegistryPath = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{BEFFBF04-40A0-4E59-87C0-223B51E92B84}_is1";
    [STAThread]
    private static int Main(string[] args) {
        bool check = args.Length == 1 && args[0] == "--check";
        if (args.Length > 0 && !check) return 2;
        try {
            string root = Path.GetFullPath(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Nexus RGB")).TrimEnd(Path.DirectorySeparatorChar);
            string executable;
            using (var registry = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64))
            using (var product = registry.OpenSubKey(RegistryPath, false)) {
                if (product == null) throw new InvalidOperationException(L.T("O Nexus RGB não foi encontrado entre os aplicativos instalados."));
                string location = product.GetValue("InstallLocation") as string;
                if (String.IsNullOrEmpty(location) || !String.Equals(Path.GetFullPath(location).TrimEnd(Path.DirectorySeparatorChar), root, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException(L.T("A instalação encontrada está fora da pasta oficial do Nexus RGB."));
                string command = product.GetValue("UninstallString") as string;
                if (String.IsNullOrEmpty(command)) throw new InvalidOperationException(L.T("O registro de desinstalação está incompleto."));
                executable = command.Trim();
                if (executable.StartsWith("\"") && executable.EndsWith("\"")) executable = executable.Substring(1, executable.Length - 2);
                if (executable.Contains("\"")) throw new InvalidOperationException(L.T("O registro de desinstalação contém parâmetros inesperados."));
                executable = Path.GetFullPath(executable);
                if (!String.Equals(Path.GetDirectoryName(executable), root, StringComparison.OrdinalIgnoreCase) || !Regex.IsMatch(Path.GetFileName(executable), @"^unins[0-9]{3}\.exe$", RegexOptions.IgnoreCase))
                    throw new InvalidOperationException(L.T("O desinstalador encontrado não corresponde ao Nexus RGB."));
            }
            for (var directory = new DirectoryInfo(root); directory != null; directory = directory.Parent) {
                if (!directory.Exists || (directory.Attributes & FileAttributes.ReparsePoint) != 0)
                    throw new InvalidOperationException(L.T("A pasta da instalação está ausente ou usa um redirecionamento de arquivos."));
            }
            foreach (string file in new[] { executable, Path.ChangeExtension(executable, ".dat"), Path.Combine(root, "NexusRGB.exe") }) {
                if (!File.Exists(file) || (File.GetAttributes(file) & FileAttributes.ReparsePoint) != 0)
                    throw new InvalidOperationException(L.T("A instalação está incompleta. Reinstale o Nexus RGB para recuperar o desinstalador."));
            }
            // --check only validates the existing installation, without UAC or removal.
            if (check) return 0;
            using (var process = Process.Start(new ProcessStartInfo(executable) { WorkingDirectory = root, UseShellExecute = true, Verb = "runas" })) { }
            return 0;
        } catch (Win32Exception error) {
            if (error.NativeErrorCode == 1223) return 3;
            if (!check) MessageBox.Show(L.T("Não foi possível abrir a desinstalação.\n\n") + error.Message, "Nexus RGB", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        } catch (Exception error) {
            if (!check) MessageBox.Show(error.Message + L.T("\n\nVocê também pode procurar Nexus RGB em Configurações > Aplicativos do Windows."), "Nexus RGB", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return 2;
        }
    }
}
