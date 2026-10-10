param(
    [string]$AdbPath = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
    [string]$Serial = 'emulator-5554'
)

# Read-only snapshot; never clears logcat, restarts the app or changes log levels.
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $AdbPath)) { throw 'ADB não encontrado. Informe -AdbPath.' }
$appProcess = ((& $AdbPath -s $Serial shell pidof com.farleyedu.zippygomotoboy) -join '').Trim()
if (-not $appProcess) { throw 'Abra o app antes de capturar os logs.' }
$appProcess = ($appProcess -split '\s+')[0]
Write-Output 'Diagnóstico nativo: últimas mensagens do processo atual; nenhum resultado não prova ausência de falha.'
& $AdbPath -s $Serial logcat -d "--pid=$appProcess" -t 4000 -v threadtime | ForEach-Object {
    $line = $_
    # JS has its own correlated logs. Here select native SDK/transport messages.
    if ($line -match '(Navigation|NavModule|NavSDK|Cronet|JavaUrlRequest|Conscrypt|SSLHandshake|TLS|UnknownHost|ConnectException|GoogleApiManager|Authorization failure)' -and $line -notmatch 'ReactNativeJS') {
        $line = $line -replace 'AIza[\w-]+', '[chave omitida]'
        $line = $line -replace 'eyJ[\w-]+\.[\w-]+\.[\w-]+', '[token omitido]'
        $line = $line -replace '(?i)Bearer\s+\S+', '[token omitido]'
        $line = $line -replace 'https?://[^\s]+', '[URL omitida]'
        $line = $line -replace '(?i)((apiKey|token|authorization|address|latitude|longitude|lat|lng)\s*[=:]\s*)[^,\s]+', '$1[omitido]'
        $line = $line -replace '-?\d+\.\d{4,}', '[coordenada omitida]'
        Write-Output $line
    }
}
if ($LASTEXITCODE -ne 0) { throw 'A captura do ADB falhou. Confira o dispositivo selecionado.' }
