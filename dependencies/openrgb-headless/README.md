# OpenRGB Headless: dependência fixada

Bundle Windows x64 produzido pelo [workflow upstream 39457060004](https://github.com/hello-nexus/openrgb-headless/actions/runs/39457060004) sobre o commit `18e2c95f5e6d5d9f45a948df1e3d0b882e605b45`. `provenance.json` registra a origem, os hashes do ZIP e de cada arquivo e a fonte correspondente. O digest do ZIP foi comparado à API do GitHub antes desta cópia. A licença GPL-2.0-or-later está em `LICENSE.txt`.

O arquivo de 3,5 MB é mantido no repositório para não depender do artefato upstream temporário, que expira. Não é um novo programa de instalação nem foi executado no PC pela aquisição. A integração ao pacote Nexus e seus ensaios precisam constar no relatório da alpha.40; este registro de origem não comprova compatibilidade física universal.

O build deve conferir todos os hashes e incluir o ZIP de fontes do commit exato no instalador. O executável é usado como processo separado pelo SDK; não há cópia de código GPL para o código MIT do Nexus. As bibliotecas e os módulos do bundle preservam suas próprias licenças. Para reproduzir a compilação, consulte o workflow `headless.yml` do commit fixado (MSVC x64, Qt 5.15.2 somente como ferramenta qmake, jom); o binário do build upstream não foi recompilado independentemente nesta aquisição.
