using System;
using System.Collections.Generic;
using System.Globalization;
using Microsoft.Win32;
internal static class L {
    internal static string LanguageOverride = null;
    internal static string Current { get { return LanguageOverride ?? selected; } }
    private static string selected = Load();
    private static string Load() { try { using (var key = Registry.CurrentUser.OpenSubKey(@"Software\NexusRGB")) { string value = key == null ? null : key.GetValue("UiLanguage") as string; if (value == "en" || value == "pt-BR") return value; } } catch {} return CultureInfo.CurrentUICulture.Name.StartsWith("pt", StringComparison.OrdinalIgnoreCase) ? "pt-BR" : "en"; }
    internal static void Select(string language) { if (language != "en" && language != "pt-BR") return; selected = language; try { using (var key = Registry.CurrentUser.CreateSubKey(@"Software\NexusRGB")) key.SetValue("UiLanguage", language); } catch {} }
    internal static string T(string text) { string value; return (LanguageOverride ?? selected) == "en" && English.TryGetValue(text, out value) ? value : text; }
    private static readonly Dictionary<string,string> English = new Dictionary<string,string> {
        { "Comando de recuperação inválido.", "Invalid recovery command." },
        { "Use o Nexus instalado em Program Files\\Nexus RGB para recuperar os serviços.", "Use Nexus installed in Program Files\\Nexus RGB to recover services." },
        { "O painel Nexus ainda não respondeu no endereço configurado. Aguarde a inicialização ou use Configurar portas no ícone perto do relógio se houver conflito.", "The Nexus dashboard has not responded at its configured address. Wait for startup or use Configure ports in the tray if there is a conflict." },
        { "\nAbra Configurar portas no ícone do Nexus.", "\nOpen Configure ports from the Nexus tray icon." },
        { "Instale ou atualize o Nexus para recuperar os serviços.", "Install or update Nexus to recover services." },
        { "Nexus RGB — Reiniciar controlador", "Nexus RGB — Restart controller" },
        { "Reiniciando Nexus e OpenRGB", "Restarting Nexus and OpenRGB" },
        { "Aguarde. As luzes podem parar por alguns segundos.\nPerfis, posições, efeitos importados e configurações serão preservados.", "Please wait. Lights may pause for a few seconds.\nProfiles, positions, imported effects and settings will be preserved." },
        { "Fechar", "Close" },
        { "A recuperação demorou além do limite. Confira os serviços e diagnósticos.", "Recovery timed out. Check services and diagnostics." },
        { "Concluído.\n", "Completed.\n" },
        { "Não foi possível concluir.\n", "Could not complete.\n" },
        { "\nRecarregue o painel para conferir o estado atual.", "\nReload the dashboard to check the current state." },
        { "Porta inválida no registro: ", "Invalid registry port: " },
        { "Use portas diferentes. Painel/SDK: 1024 a 65535. Alexa: 1 a 65535.", "Use different ports. Dashboard/SDK: 1024 to 65535. Alexa: 1 to 65535." },
        { "Nexus RGB — Configurar portas", "Nexus RGB — Configure ports" },
        { "Escolha portas diferentes das usadas por outros aplicativos.\nOs links e o firewall do Nexus serão atualizados ao aplicar.", "Choose ports not used by other applications.\nNexus links and firewall rules will be updated when applied." },
        { "Painel web / celular", "Web / phone dashboard" },
        { "SDK OpenRGB (somente neste PC)", "OpenRGB SDK (this PC only)" },
        { "Ponte Alexa (recomendado: 80)", "Alexa bridge (recommended: 80)" },
        { "Descoberta Alexa: UDP 1900, definida pelo protocolo.\nOutra porta HTTP pode não funcionar com alguns Echos.\nAo mudar o painel, atualize os favoritos e o link do celular.", "Alexa discovery: UDP 1900, defined by the protocol.\nOther HTTP ports may not work with some Echos.\nUpdate bookmarks and your phone link after changes." },
        { "Aplicar e reiniciar Nexus", "Apply and restart Nexus" },
        { "Consulte ProgramData\\NexusRGB\\ports-error.log.", "See ProgramData\\NexusRGB\\ports-error.log." },
        { "A alteração não foi aplicada.\n", "The change was not applied.\n" },
        { "Portas atualizadas. Abra o Nexus pelo ícone para usar o novo endereço.", "Ports updated. Open Nexus from its tray icon to use the new address." },
        { "Buscar livre", "Find free port" },
        { "Não foi encontrada uma porta livre próxima. Escolha outro número.", "No nearby free port found. Choose another number." },
        { "Nexus RGB: verificando serviço", "Nexus RGB: checking service" },
        { "Abrir Nexus RGB", "Open Nexus RGB" },
        { "Copiar link para o celular", "Copy phone link" },
        { "Configurar portas…", "Configure ports…" },
        { "Reiniciar Nexus e OpenRGB…", "Restart Nexus and OpenRGB…" },
        { "Abrir pasta de diagnósticos", "Open diagnostics folder" },
        { "Fechar ícone (manter as luzes)", "Exit tray (keep lights running)" },
        { "Nexus RGB: serviço parado", "Nexus RGB: service stopped" },
        { "Nexus RGB: painel ativo na porta ", "Nexus RGB: dashboard running on port " },
        { "Nexus RGB: painel indisponível na porta ", "Nexus RGB: dashboard unavailable on port " },
        { "Nexus RGB: confira serviços e portas", "Nexus RGB: check services and ports" },
        { "Link copiado", "Link copied" },
        { "Abra este endereço no celular conectado ao mesmo Wi-Fi.", "Open this address on your phone connected to the same Wi-Fi." },
        { "Rede indisponível", "Network unavailable" },
        { "Conecte o PC a uma rede Wi-Fi ou Ethernet privada.", "Connect your PC to private Wi-Fi or Ethernet." },
        { "Use o instalador para criar a pasta do serviço.", "Use the installer to create the service directory." },
        { "Não foi possível supervisionar o processo.", "Could not supervise the process." },
        { "Job Object indisponível.", "Job Object unavailable." },
        { "Falha no supervisor de processos.", "Process supervisor failure." },
        { "O Nexus RGB não foi encontrado entre os aplicativos instalados.", "Nexus RGB was not found among installed applications." },
        { "A instalação encontrada está fora da pasta oficial do Nexus RGB.", "The installation is outside the official Nexus RGB directory." },
        { "O registro de desinstalação está incompleto.", "The uninstall registry entry is incomplete." },
        { "O registro de desinstalação contém parâmetros inesperados.", "The uninstall registry entry contains unexpected parameters." },
        { "O desinstalador encontrado não corresponde ao Nexus RGB.", "The uninstaller does not match Nexus RGB." },
        { "A pasta da instalação está ausente ou usa um redirecionamento de arquivos.", "The installation directory is missing or uses a filesystem link." },
        { "A instalação está incompleta. Reinstale o Nexus RGB para recuperar o desinstalador.", "The installation is incomplete. Reinstall Nexus RGB to recover its uninstaller." },
        { "Não foi possível abrir a desinstalação.\n\n", "Could not open the uninstaller.\n\n" },
        { "\n\nVocê também pode procurar Nexus RGB em Configurações > Aplicativos do Windows.", "\n\nYou can also find Nexus RGB under Windows Settings > Apps." }
    };
}
