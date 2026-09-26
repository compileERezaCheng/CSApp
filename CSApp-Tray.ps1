Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$mutex = [Threading.Mutex]::new($true, 'Local\CSAppTray', [ref]$created)
if (-not $created) {
    Start-Process 'http://localhost:7331'
    $mutex.Dispose()
    return
}

$icon = $null
$tray = $null
$timer = $null
$server = $null
$serverStarted = $false
$stdoutFile = $null
$stderrFile = $null
$stdoutTask = $null
$stderrTask = $null
try {
    $env:CSAPP_TRAY_TOKEN = [guid]::NewGuid().ToString('N')
    $headers = @{ 'x-csapp-tray-token' = $env:CSAPP_TRAY_TOKEN }
    $url = 'http://127.0.0.1:7331/api/tray'
    $env:CSAPP_NO_BROWSER = '1'
    $info = [System.Diagnostics.ProcessStartInfo]::new()
    $info.FileName = Join-Path $PSScriptRoot 'CSApp_Server.exe'
    $info.WorkingDirectory = $PSScriptRoot
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $server = [System.Diagnostics.Process]::new()
    $server.StartInfo = $info
    if (-not $server.Start()) { throw 'Não foi possível iniciar o servidor.' }
    $serverStarted = $true
    $stdoutFile = [System.IO.File]::Create((Join-Path $PSScriptRoot 'server.stdout.log'))
    $stderrFile = [System.IO.File]::Create((Join-Path $PSScriptRoot 'server.stderr.log'))
    $stdoutTask = $server.StandardOutput.BaseStream.CopyToAsync($stdoutFile)
    $stderrTask = $server.StandardError.BaseStream.CopyToAsync($stderrFile)

    $context = [System.Windows.Forms.ApplicationContext]::new()
    $menu = [System.Windows.Forms.ContextMenuStrip]::new()
    $open = $menu.Items.Add('Abrir Dashboard')
    $toggle = $menu.Items.Add('Iniciar Timer')
    $null = $menu.Items.Add([System.Windows.Forms.ToolStripSeparator]::new())
    $quit = $menu.Items.Add('Sair do CSApp')
    $icon = [System.Drawing.Icon]::new((Join-Path $PSScriptRoot 'icon.ico'))
    $tray = [System.Windows.Forms.NotifyIcon]::new()
    $tray.Icon = $icon
    $tray.Text = 'CSApp'
    $tray.ContextMenuStrip = $menu
    $tray.Visible = $true

    $open.Add_Click({ Start-Process 'http://localhost:7331' })
    $tray.Add_DoubleClick({ Start-Process 'http://localhost:7331' })
    $toggle.Add_Click({
        try {
            $state = Invoke-RestMethod -Uri "$url/toggle" -Method Post -Headers $headers -TimeoutSec 2
            $toggle.Text = if ($state.isRunning) { 'Pausar Timer' } else { 'Iniciar Timer' }
        } catch {
            [System.Windows.Forms.MessageBox]::Show('O servidor ainda não está disponível.', 'CSApp') | Out-Null
        }
    })
    $quit.Add_Click({
        try { Invoke-RestMethod -Uri "$url/exit" -Method Post -Headers $headers -TimeoutSec 2 | Out-Null }
        catch {
            [System.Windows.Forms.MessageBox]::Show('Não foi possível guardar e encerrar o CSApp. Consulta server.stderr.log.', 'CSApp') | Out-Null
            return
        }
        if (-not $server.WaitForExit(4000)) { $server.Kill() }
        $context.ExitThread()
    })

    $timer = [System.Windows.Forms.Timer]::new()
    $timer.Interval = 2000
    $script:dashboardOpened = $false
    $timer.Add_Tick({
        if ($server.HasExited) {
            $timer.Stop()
            [System.Windows.Forms.MessageBox]::Show('O servidor terminou. Consulta server.stderr.log para detalhes.', 'CSApp') | Out-Null
            $context.ExitThread()
            return
        }
        try {
            $state = Invoke-RestMethod -Uri $url -Headers $headers -TimeoutSec 1
            $toggle.Text = if ($state.isRunning) { 'Pausar Timer' } else { 'Iniciar Timer' }
            if (-not $script:dashboardOpened) {
                $script:dashboardOpened = $true
                Start-Process 'http://localhost:7331'
            }
        } catch {}
    })
    $timer.Start()
    [System.Windows.Forms.Application]::Run($context)
} catch {
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'CSApp') | Out-Null
} finally {
    if ($timer) { $timer.Stop(); $timer.Dispose() }
    if ($tray) { $tray.Visible = $false; $tray.Dispose() }
    if ($icon) { $icon.Dispose() }
    if ($serverStarted -and -not $server.HasExited) { $server.Kill() }
    if ($serverStarted) { $server.WaitForExit(2000) | Out-Null }
    if ($stdoutTask -and $stderrTask) { [System.Threading.Tasks.Task]::WaitAll([System.Threading.Tasks.Task[]]@($stdoutTask, $stderrTask), 2000) | Out-Null }
    if ($stdoutFile) { $stdoutFile.Dispose() }
    if ($stderrFile) { $stderrFile.Dispose() }
    if ($server) { $server.Dispose() }
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
