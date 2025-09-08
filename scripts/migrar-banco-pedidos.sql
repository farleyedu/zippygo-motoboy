-- 🗄️ SCRIPT DE MIGRAÇÃO DO BANCO DE DADOS
-- ⚠️  ATENÇÃO: Execute apenas se decidir modificar o banco!
-- 📋 Este script converte a estrutura atual para o formato esperado pelo app

-- 🔒 1. BACKUP DA TABELA ATUAL (OBRIGATÓRIO!)
CREATE TABLE pedido_backup AS SELECT * FROM pedido;

-- 📊 2. VERIFICAR DADOS ANTES DA MIGRAÇÃO
SELECT 
    COUNT(*) as total_pedidos,
    COUNT(DISTINCT status_pedido) as status_diferentes,
    COUNT(CASE WHEN items IS NOT NULL AND items != '' THEN 1 END) as pedidos_com_items,
    COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as pedidos_com_coordenadas
FROM pedido;

-- 🏗️ 3. CRIAR NOVA ESTRUTURA (FORMATO DO APP)
CREATE TABLE pedidos_novo (
    id SERIAL PRIMARY KEY,
    
    -- 👤 Dados do Cliente
    cliente_nome VARCHAR(255),
    cliente_telefone VARCHAR(20),
    cliente_documento VARCHAR(50),
    
    -- 📍 Endereço e Localização
    endereco_entrega TEXT,
    coordenadas JSONB, -- {"lat": -18.91633, "lng": -48.27952}
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    estado VARCHAR(50),
    cep VARCHAR(10),
    
    -- 🛍️ Dados do Pedido
    itens JSONB, -- [{"nome": "Pizza", "quantidade": 1, "valor": 25.90}]
    valor_total DECIMAL(10,2),
    tipo_pagamento VARCHAR(50),
    
    -- 📋 Status e Controle
    status VARCHAR(20), -- 'disponivel', 'aceito', 'em_entrega', 'entregue', 'cancelado'
    motoboy_responsavel INTEGER,
    
    -- ⏰ Horários
    data_pedido TIMESTAMP,
    horario_entrega TIMESTAMP,
    previsao_entrega TIMESTAMP,
    horario_saida TIMESTAMP,
    
    -- 🔗 Integrações
    id_ifood VARCHAR(100),
    localizador VARCHAR(100),
    region VARCHAR(50),
    
    -- 📅 Controle do Sistema
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 🔄 4. MIGRAR DADOS DA TABELA ANTIGA PARA A NOVA
INSERT INTO pedidos_novo (
    id, cliente_nome, cliente_telefone, cliente_documento,
    endereco_entrega, coordenadas, bairro, cidade, estado, cep,
    itens, valor_total, tipo_pagamento,
    status, motoboy_responsavel,
    data_pedido, horario_entrega, previsao_entrega, horario_saida,
    id_ifood, localizador, region
)
SELECT 
    id,
    
    -- 👤 Cliente
    nome_cliente,
    telefone_cliente,
    documento_cliente,
    
    -- 📍 Endereço
    endereco_entrega,
    -- Criar objeto JSON para coordenadas
    CASE 
        WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN
            jsonb_build_object(
                'lat', latitude::float,
                'lng', longitude::float
            )
        ELSE 
            jsonb_build_object('lat', 0, 'lng', 0)
    END as coordenadas,
    entrega_bairro,
    entrega_cidade,
    entrega_estado,
    entrega_cep,
    
    -- 🛍️ Itens (converter string para JSON)
    CASE 
        -- Se já é um JSON válido
        WHEN items IS NOT NULL AND items::text ~ '^\\[.*\\]$' THEN 
            items::jsonb
        -- Se é um objeto JSON
        WHEN items IS NOT NULL AND items::text ~ '^\\{.*\\}$' THEN 
            jsonb_build_array(items::jsonb)
        -- Se é uma string simples
        WHEN items IS NOT NULL AND items != '' THEN 
            jsonb_build_array(
                jsonb_build_object(
                    'nome', items,
                    'quantidade', 1,
                    'valor', COALESCE(value::float, 0)
                )
            )
        -- Se está vazio
        ELSE 
            '[]'::jsonb
    END as itens,
    
    -- 💰 Valor
    COALESCE(value::decimal, 0) as valor_total,
    tipo_pagamento,
    
    -- 📋 Status (converter número para string)
    CASE status_pedido
        WHEN 1 THEN 'disponivel'
        WHEN 2 THEN 'aceito'
        WHEN 3 THEN 'em_entrega'
        WHEN 4 THEN 'entregue'
        WHEN 5 THEN 'cancelado'
        ELSE 'disponivel'
    END as status,
    
    motoboy_responsavel,
    
    -- ⏰ Horários (converter strings para timestamps)
    CASE 
        WHEN data_pedido IS NOT NULL THEN data_pedido::timestamp
        ELSE NOW()
    END,
    CASE 
        WHEN horario_entrega IS NOT NULL THEN horario_entrega::timestamp
        ELSE NULL
    END,
    CASE 
        WHEN previsao_entrega IS NOT NULL THEN previsao_entrega::timestamp
        ELSE NULL
    END,
    CASE 
        WHEN horario_saida IS NOT NULL THEN horario_saida::timestamp
        ELSE NULL
    END,
    
    -- 🔗 Integrações
    id_ifood,
    localizador,
    region
    
FROM pedido;

-- 📊 5. VERIFICAR MIGRAÇÃO
SELECT 
    'Tabela Original' as tabela,
    COUNT(*) as total_registros
FROM pedido
UNION ALL
SELECT 
    'Tabela Nova' as tabela,
    COUNT(*) as total_registros
FROM pedidos_novo;

-- 🔍 6. COMPARAR ALGUNS REGISTROS
SELECT 
    'ANTES' as momento,
    id,
    nome_cliente,
    status_pedido,
    items,
    latitude,
    longitude
FROM pedido 
LIMIT 3
UNION ALL
SELECT 
    'DEPOIS' as momento,
    id,
    cliente_nome,
    status,
    itens::text,
    (coordenadas->>'lat'),
    (coordenadas->>'lng')
FROM pedidos_novo 
LIMIT 3;

-- ⚠️ 7. COMANDOS PARA FINALIZAR MIGRAÇÃO (EXECUTE APENAS SE TUDO ESTIVER OK!)
/*
-- Renomear tabelas
ALTER TABLE pedido RENAME TO pedido_old;
ALTER TABLE pedidos_novo RENAME TO pedido;

-- Criar índices para performance
CREATE INDEX idx_pedido_status ON pedido(status);
CREATE INDEX idx_pedido_motoboy ON pedido(motoboy_responsavel);
CREATE INDEX idx_pedido_data ON pedido(data_pedido);
CREATE INDEX idx_pedido_coordenadas ON pedido USING GIN(coordenadas);

-- Atualizar sequência do ID
SELECT setval('pedido_id_seq', (SELECT MAX(id) FROM pedido));
*/

-- 🔙 8. SCRIPT DE ROLLBACK (SE ALGO DER ERRADO)
/*
-- Para voltar ao estado anterior:
DROP TABLE IF EXISTS pedido;
ALTER TABLE pedido_old RENAME TO pedido;
DROP TABLE IF EXISTS pedidos_novo;
*/

-- 📋 RESUMO DO QUE ESTE SCRIPT FAZ:
-- ✅ Faz backup da tabela original
-- ✅ Cria nova estrutura alinhada com o app
-- ✅ Migra todos os dados convertendo formatos
-- ✅ Converte status de número para string
-- ✅ Converte coordenadas para JSON
-- ✅ Converte itens para array JSON
-- ✅ Preserva todos os dados importantes
-- ✅ Fornece verificações de integridade
-- ✅ Inclui scripts de rollback

-- 🚨 IMPORTANTE:
-- 1. Execute em ambiente de teste primeiro!
-- 2. Faça backup completo do banco antes
-- 3. Execute durante horário de baixo uso
-- 4. Teste a aplicação após a migração
-- 5. Mantenha o backup por alguns dias