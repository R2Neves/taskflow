# Migração dos dados do Felipe

Este procedimento transfere a instalação local do Felipe para o servidor
central. A origem escolhida é o banco completo do Felipe; não tente mesclar
linhas manualmente com o banco atual.

## 1. Entrega e validação do arquivo

O Felipe deve gerar um backup PostgreSQL completo no computador dele e enviar o
arquivo por um canal interno seguro. Não envie `.env`, senhas ou tokens.

No servidor central, valide o arquivo sem restaurá-lo:

```powershell
.\scripts\lan\inspect-backup.ps1 -Path C:\CAMINHO\backup-taskflow.dump
```

Registre o tamanho e o SHA-256 exibidos. O formato deve ser PostgreSQL custom
archive ou SQL text.

## 2. Janela de migração

1. Avise os usuários e interrompa o uso do TaskFlow.
2. Guarde um backup do banco central atual.
3. O responsável humano pela infraestrutura restaura o arquivo do Felipe no
   banco `taskflow`.
4. Não recrie, edite ou remapeie IDs manualmente.
5. Reinicie a pilha central.

Por política do projeto, o agente Cursor não executa restauração, limpeza,
alteração de schema nem qualquer outra escrita direta no banco.

## 3. Validação somente leitura

Após a restauração humana:

```powershell
.\scripts\lan\validate-migrated-data.ps1
```

O relatório deve:

- localizar `flima@beautyservices.com.br`;
- apresentar totais de usuários, equipes e atividades;
- mostrar zero em todos os relacionamentos órfãos.

Depois, valide pela aplicação:

1. Felipe entra pela URL `http://IP_DO_SERVIDOR:3080`.
2. O administrador visualiza Felipe em `/admin`.
3. O proprietário adiciona Felipe à equipe, se a associação não vier no backup.
4. Ambos confirmam as mesmas equipes e atividades.
5. Todos removem favoritos antigos de `localhost` e encerram sessões antigas.

## 4. Segurança

- Felipe deve trocar a senha que foi compartilhada durante o diagnóstico.
- O arquivo de backup deve ficar em local restrito e ser removido conforme a
  política interna de retenção.
- Não publique as portas 3001 e 5432 na rede.
