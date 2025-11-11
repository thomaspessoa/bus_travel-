# Rizzatti - Sistema de Rastreamento de Ônibus em Tempo Real

Bem-vindo ao Rizzatti! Este é um sistema completo para rastreamento de ônibus em tempo real, com painéis dedicados para administradores e motoristas.

## Visão Geral das Funcionalidades

*   **Painel do Administrador:** Monitore todos os ônibus em um mapa ao vivo, veja a velocidade, histórico de viagens, e trajetos percorridos.
*   **Painel do Motorista:** Inicie novas viagens, gere rotas otimizadas e adicione observações ao final do percurso.

## Como Executar o Projeto

Este projeto foi desenhado para ser simples de iniciar. Siga os passos abaixo.

### 1. Pré-requisitos

*   Você precisa ter o [Node.js](https://nodejs.org/) (que inclui o `npm`) instalado no seu computador.
*   Você precisa ter o `openssl` instalado.
    *   **Windows:** Pode ser necessário instalar o [Git for Windows](https://git-scm.com/download/win), que inclui o Git Bash e o `openssl`.
    *   **Linux/macOS:** Geralmente já vem instalado.

### 2. Instalação

Abra o terminal na pasta raiz do projeto e instale as dependências necessárias:

```bash
npm install
```

### 3. Gerando o Certificado de Segurança (Obrigatório para Geolocation)

O recurso de geolocalização em navegadores modernos (especialmente em celulares) **exige uma conexão segura (HTTPS)**. Para criar um ambiente de desenvolvimento seguro localmente, precisamos gerar um certificado SSL autoassinado.

**Execute este comando no terminal, na raiz do projeto:**

```bash
openssl req -nodes -new -x509 -keyout key.pem -out cert.pem
```

*   O comando irá pedir algumas informações (país, estado, etc.). Você pode preencher com qualquer dado ou simplesmente pressionar Enter para pular.
*   Isso criará dois arquivos na raiz do projeto: `key.pem` e `cert.pem`. **Não apague esses arquivos.**

### 4. Iniciando o Servidor

Com as dependências instaladas e os certificados gerados, inicie o servidor com o comando:

```bash
npm start
```

Você verá uma mensagem indicando que o servidor está rodando em `https://[SEU_IP_LOCAL]:3000`.

### 5. Acessando a Aplicação (Muito Importante!)

#### No Computador (Admin)

1.  Abra seu navegador (Chrome, Firefox, etc).
2.  Acesse `https://localhost:3000`.
3.  Você verá um **aviso de segurança** dizendo "Sua conexão não é particular" ou algo similar. Isso é esperado, pois o certificado foi gerado por nós e não por uma autoridade oficial.
4.  Clique em "Avançado" e depois em "**Continuar para localhost (não seguro)**".
5.  Pronto! Faça login como administrador:
    *   **Email:** `adm@hotmail.com`
    *   **Senha:** `adm123`

#### No Celular (Motorista)

1.  **Conecte seu celular na mesma rede Wi-Fi** do computador que está rodando o servidor.
2.  Descubra o endereço de IP local do seu computador.
    *   **Windows:** Abra o `cmd` e digite `ipconfig`. Procure pelo "Endereço IPv4".
    *   **Linux/macOS:** Abra o terminal e digite `ifconfig` ou `ip a`. Procure pelo endereço `inet`.
3.  No navegador do seu celular, digite o endereço completo, substituindo `[SEU_IP_LOCAL]` pelo IP que você encontrou. Exemplo: `https://192.168.1.10:3000`.
4.  Você também verá o **aviso de segurança** no navegador do celular. Assim como no computador, é necessário aceitar o risco para prosseguir. A opção pode ser "Avançado" -> "Continuar para [IP] (não seguro)".
5.  Após aceitar, a página irá carregar. Faça login como motorista:
    *   **Email:** `motorista@hotmail.com`
    *   **Senha:** `motorista2026`
6.  Ao clicar em "Iniciar Viagem", o navegador do celular irá pedir **permissão para acessar sua localização**. **Você deve permitir** para que o rastreamento funcione.

Seguindo esses passos, o sistema estará 100% funcional, incluindo o rastreamento por GPS no celular.
