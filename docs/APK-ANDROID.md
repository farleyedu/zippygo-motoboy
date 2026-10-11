# APK Android para teste de campo

## Build EAS — correção de 11/10/2026

O build `a88f9ea6-65c0-47b1-94b8-12396fbaaf89` falhou ao configurar o Gradle: o diretório da biblioteca de navegação apareceu como `/home/expo/workingdir/build/android/C:/Users/farle/...`. O arquivo `android/build/generated/autolinking/autolinking.json`, gerado no Windows, entrou no pacote enviado ao Linux.

Criado `.easignore` com as regras do `.gitignore` e exclusão explícita dos caches `android/build`, `android/app/build`, `.gradle`, `.cxx`, `local.properties`, `ios/build` e `Pods`. As pastas nativas e os patches do SDK continuam no pacote. `eas build:inspect -p android -s archive -e preview` confirmou: `android/settings.gradle` presente, arquivo de autolinking ausente e nenhum arquivo nos quatro diretórios de cache Android. O servidor gera o autolinking com seus próprios caminhos. Referência: [arquivos ignorados pelo EAS](https://docs.expo.dev/build-reference/easignore/).

O perfil `preview` fixa a API HTTPS de produção, usa o ambiente EAS `preview` e desativa mocks e logs detalhados. Comando solicitado pelo usuário: `eas build --platform android --profile preview`. A execução `34923bfc-c8a9-488e-bd6a-6cb338cdb3d9` terminou com sucesso em 11/10 e comprovou a correção do Gradle; antecede os novos balões e a configuração Firebase. Uma execução intermediária foi cancelada para incluir a proteção final do rascunho.

**Build final concluído:** [7dc9fea2-294c-4bdd-bad5-57d48f5409a6](https://expo.dev/accounts/farleyedu/projects/zippygo-motoboy/builds/7dc9fea2-294c-4bdd-bad5-57d48f5409a6), em 11/10/2026. [APK assinado pelo Expo](https://expo.dev/artifacts/eas/UBbA-Y1dM3errXkLI8_WLcnzkvy8Kc7Yyd6Ky8ovonQ.apk), 164.732.179 bytes, SHA-256 `8960d0ea722fa368f7cb251c1e6c6ed2d029ae4b31432424aec2186e47c9bb14`. Gradle executou `:app:processReleaseGoogleServices`. Inspeção do APK confirmou `google_app_id`, `gcm_defaultSenderId` e `project_id` iguais ao arquivo Firebase local, provider de inicialização, serviço FCM e permissão de notificações presentes. Bundle Hermes contém o chat atualizado. Arquiteturas ARM64, ARMv7, x86 e x86_64. Assinatura e alinhamento ZIP de 16 KiB verificados.

**Atualização compatível com o APK local de 10/10:** `.expo/field-apk/ZippyGo-chat-firebase-2026-10-11.apk`, copiado para `C:\Users\farle\Downloads\ZippyGo-chat-firebase-2026-10-11.apk`. É o mesmo APK, assinado com a chave local de teste já usada na instalação anterior. Certificado SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`, idêntico ao pacote de 10/10; hash do bundle idêntico ao APK EAS. Pacote com 164.991.778 bytes, SHA-256 `a204129925d582fab093ac60a1cb773a044c54fb646ae7e869e8cf9d6fbdc249`. Versão `1.0.0`, código **16**, pacote `com.farleyedu.zippygomotoboy`, alvo Android API 36, sem flag `debuggable`. Firebase, assinatura e alinhamento reconferidos após assinar. Não foi instalado no aparelho: nenhum dispositivo estava conectado.

Firebase conferido em 11/10: `google-services.json` local do projeto `zippy-48668`, pacote `com.farleyedu.zippygomotoboy`, e credencial FCM v1 do mesmo projeto presente no Expo. Não há variáveis EAS cadastradas; o arquivo público é incluído pela exceção no `.easignore`. Como as pastas nativas são enviadas, EAS não executa Prebuild automaticamente. O hook `eas-build-post-install` valida o arquivo e copia para `android/app/google-services.json`; Gradle aplica `com.google.gms.google-services` quando ele existe. Preserva as alterações do SDK de navegação. Também suporta a variável de arquivo `GOOGLE_SERVICES_JSON` quando configurada no futuro, e recusa JSON de conta de serviço ou de outro pacote. Quatro testes do hook passaram. A credencial privada não entra no Git nem no APK. Referências: [FCM no Expo](https://docs.expo.dev/push-notifications/fcm-credentials/), [hooks do build](https://docs.expo.dev/build-reference/npm-hooks/).

O APK EAS usa a assinatura remota do Expo, diferente da chave de teste do APK local de 10/10. Para atualizar essa instalação preservando os dados, usar o pacote compatível de Downloads descrito acima. Push com aplicativo fechado ainda precisa ser testado em aparelho real, com permissão de notificações e token registrado no servidor.

## Pacotes anteriores

Pacote preparado a partir do checkout principal `zippygo-motoboy`, incluindo as alterações locais de 10/10/2026. A versão `release` incorpora o JavaScript e os assets: o celular abre o aplicativo sem Expo Go, Metro ou computador conectado.

## Instalação e uso

**Atualização de sessão ativa (10/10):** APK mais recente `ZippyGo-sessao-2026-10-10.apk`, recompilado e instalado no Xiaomi com `adb install -r` (Success). Cópias em `.expo/field-apk/`, Downloads do computador e Downloads do celular. Inclui o aviso de acesso em outro aparelho; esse aviso depende também da publicação do backend atualizado. SHA-256 `a5822403d166de6a0e1f4372538d6bc98cc09c74103ccd8ebe769636ab35dc29`. Validação e pendências em [SESSAO-UNICA.md](SESSAO-UNICA.md). O pacote inicial descrito abaixo permanece disponível como referência.

O APK está em `.expo/field-apk/ZippyGo-teste-2026-10-10.apk`, com cópias na pasta Downloads do computador e em `Download/ZippyGo-teste-2026-10-10.apk` no celular. A instalação pelo USB usa `adb install -r` e preserva os dados de uma instalação compatível existente.

Para instalar manualmente, copie o APK para o celular, abra o arquivo e permita a instalação por esse gerenciador de arquivos quando o Android solicitar. Depois abra `zippygo-motoboy`.

No Xiaomi conectado, o Android recusou as duas primeiras tentativas por ADB com `INSTALL_FAILED_USER_RESTRICTED: Install canceled by user`. Após Farley liberar a instalação, a nova tentativa retornou **Success** e o aplicativo abriu normalmente. Para repetir pelo USB, manter **Instalar via USB** habilitado nas Opções do desenvolvedor e confirmar a instalação no aparelho. O APK também está em Downloads para instalação pelo gerenciador de arquivos. Na confirmação opcional do Play Protect foi escolhido **Não enviar**; o agente não autorizou envio do APK ao Google nem alterou as configurações de verificação do sistema.

1. Entre com sua conta e selecione a loja vinculada.
2. Na preparação do turno, permita localização precisa com o app aberto e depois localização **o tempo todo**, além das notificações.
3. Nas configurações de bateria do Android, permita o funcionamento do ZippyGo em segundo plano; no Xiaomi, confira também a opção de início automático se o sistema restringir o app.
4. Desconecte o USB e use os dados móveis. Fique online e confira no painel da loja se a posição acompanha o deslocamento.
5. Teste o retorno de Maps/Waze e o bloqueio da tela. Compare o horário da última posição no app e no painel.
6. Teste uma perda breve de internet e a recuperação da conexão. Confira se a sessão e os pedidos continuam disponíveis e se o GPS volta a atualizar.

## Configuração deste pacote

- API: `https://zippy-api.onrender.com`.
- Ambiente: `EXPO_PUBLIC_APP_ENV=production`.
- Simulações de navegador e logs detalhados da API desativados.
- Identificador Android: `com.farleyedu.zippygomotoboy`.
- Arquitetura: `arm64-v8a`, compatível com o Xiaomi conectado. Este APK exige um Android com suporte a ARM64.
- Versão: `1.0.0`, código `1`, Android mínimo API 24 e alvo API 36.
- Assinatura: chave local de teste já configurada no projeto; este pacote é para instalação direta.
- GPS, câmera e microfone usam as implementações nativas. A movimentação real e o comportamento de bateria precisam de teste no aparelho.

Na consulta de 10/10/2026, a API pública respondeu HTTP 200 no Swagger e expôs os endpoints de sessão, fila e localização em lote. A configuração de atenção do motoboy adicionada hoje ao backend ainda não apareceu nesse contrato publicado. Esse recurso depende da publicação do backend e da migration correspondente.

Nos pacotes locais antigos de 10/10, push remoto não foi validado e Firebase não estava configurado. A preparação atual está descrita no início deste documento; notificações locais e sons não comprovam recebimento de push com o app fechado.

## Reproduzir a compilação local

Execute no diretório raiz do app, em PowerShell:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = 'C:\Users\farle\AppData\Local\Android\Sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:EXPO_PUBLIC_APP_ENV = 'production'
$env:EXPO_PUBLIC_API_BASE_URL = 'https://zippy-api.onrender.com'
$env:EXPO_PUBLIC_BROWSER_MOCKS = 'false'
$env:EXPO_PUBLIC_API_DEBUG = 'false'
$env:NODE_ENV = 'production'
$env:CI = '1'
$env:CMAKE_BUILD_PARALLEL_LEVEL = '2'
Push-Location android
try {
    & .\gradlew.bat :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --max-workers=2 --no-parallel '-Dorg.gradle.jvmargs=-Xmx3072m -XX:MaxMetaspaceSize=1024m' --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar o APK.' }
} finally {
    Pop-Location
}
```

A saída do Gradle é `android/app/build/outputs/apk/release/app-release.apk`. Alterar a URL pública exige recompilar o bundle, conforme a [documentação de variáveis do Expo](https://docs.expo.dev/guides/environment-variables/). O formato APK permite [instalação direta no Android](https://docs.expo.dev/build-reference/apk/).

## Validação desta geração

- TypeScript: `tsc --noEmit` passou.
- Aparelho reconhecido por USB: Xiaomi `25078PC3EG`, Android 15 / API 35, com suporte a `arm64-v8a`.
- Gradle: `BUILD SUCCESSFUL in 13m 8s`; 908 tarefas, incluindo lint da variante release. A tentativa anterior com todas as arquiteturas encontrou `build.ninja still dirty after 100 tries` em `armeabi-v7a` e foi interrompida; o pacote final foi compilado somente para ARM64.
- Assinatura APK v2 verificada por `apksigner verify`; alinhamento ZIP de 16 KiB verificado por `zipalign -c -P 16 4`.
- APK com `74.885.117` bytes; contém `assets/index.android.bundle` em Hermes, com a URL da API pública. Sem flag `debuggable` no APK.
- SHA-256: `7823940214546535e285fdcd10f9822298897ec43939e6048dbcdd3f4825cb28`.
- Cópia para Downloads do celular concluída e SHA-256 conferido no próprio aparelho: idêntico ao pacote do computador.
- Instalação por ADB concluída com **Success**, em 10/10/2026 às 14:13, horário de São Paulo. Abertura a frio com `am start -W`: **Status ok**, 4.048 ms.
- Tela de boas-vindas conferida no aparelho; processo permaneceu ativo. Logs do processo coletados sem erros fatais ou exceções JavaScript. APK sem flag `DEBUGGABLE`; `adb reverse --list` vazio, sem ligação do celular ao Metro. Captura: `.expo/field-apk/app-first-launch.png`.
- Login, turno, GPS em movimento/segundo plano, Maps/Waze e push remoto continuam pendentes de teste pelo usuário; a abertura não comprova essas funções.
- Logs e evidências locais: `.expo/field-apk/`, ignorada pelo Git.
