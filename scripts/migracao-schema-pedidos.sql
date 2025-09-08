-- =====================================================
-- MIGRAÇÃO COMPLETA DO SCHEMA DE PEDIDOS
-- Refatoração para suportar o objeto Pedido do front-end
-- =====================================================

BEGIN;

-- 1. VERIFICAÇÃO DA ESTRUTURA ATUAL
DO $$
BEGIN
    -- Verificar se as tabelas existem
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pedido') THEN
        RAISE EXCEPTION 'Tabela pedido não encontrada!';
    END IF;
    
    RAISE NOTICE 'Iniciando migração do schema de pedidos...';
END $$;

-- 2. BACKUP DA ESTRUTURA ATUAL
CREATE TABLE IF NOT EXISTS pedido_backup AS SELECT * FROM pedido;
RAISE NOTICE 'Backup da tabela pedido criado';

-- 3. CRIAR TABELA CLIENTE (se não existir)
CREATE TABLE IF NOT EXISTS cliente (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    telefone VARCHAR(20),
    email VARCHAR(255),
    endereco_principal TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. ADICIONAR COLUNAS À TABELA PEDIDO (se não existirem)
DO $$
BEGIN
    -- Adicionar cliente_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedido' AND column_name = 'cliente_id') THEN
        ALTER TABLE pedido ADD COLUMN cliente_id INTEGER;
    END IF;
    
    -- Adicionar coordenadas estruturadas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedido' AND column_name = 'coordenadas') THEN
        ALTER TABLE pedido ADD COLUMN coordenadas JSONB;
    END IF;
    
    -- Adicionar itens estruturados
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedido' AND column_name = 'itens_estruturados') THEN
        ALTER TABLE pedido ADD COLUMN itens_estruturados JSONB;
    END IF;
    
    -- Adicionar timestamps
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedido' AND column_name = 'created_at') THEN
        ALTER TABLE pedido ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedido' AND column_name = 'updated_at') THEN
        ALTER TABLE pedido ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- 5. CRIAR TABELA TIMELINE_PEDIDO
CREATE TABLE IF NOT EXISTS timeline_pedido (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL,
    status_anterior VARCHAR(50),
    status_novo VARCHAR(50) NOT NULL,
    timestamp_evento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    observacoes TEXT,
    motoboy_id INTEGER,
    localizacao JSONB
);

-- 6. CRIAR TABELA ITENS_PEDIDO (normalizada)
CREATE TABLE IF NOT EXISTS itens_pedido (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL,
    nome VARCHAR(255) NOT NULL,
    quantidade INTEGER DEFAULT 1,
    preco_unitario DECIMAL(10,2),
    observacoes TEXT,
    categoria VARCHAR(100)
);

-- 7. MIGRAR DADOS EXISTENTES

-- 7.1 Migrar clientes únicos
INSERT INTO cliente (nome, telefone)
SELECT DISTINCT 
    COALESCE(nome_cliente, 'Cliente Sem Nome') as nome,
    telefone_cliente as telefone
FROM pedido 
WHERE nome_cliente IS NOT NULL 
    AND NOT EXISTS (
        SELECT 1 FROM cliente c 
        WHERE c.nome = COALESCE(pedido.nome_cliente, 'Cliente Sem Nome')
        AND c.telefone = pedido.telefone_cliente
    );

-- 7.2 Atualizar pedidos com cliente_id
UPDATE pedido 
SET cliente_id = c.id
FROM cliente c
WHERE c.nome = COALESCE(pedido.nome_cliente, 'Cliente Sem Nome')
    AND c.telefone = pedido.telefone_cliente;

-- 7.3 Migrar coordenadas para formato JSON
UPDATE pedido 
SET coordenadas = jsonb_build_object(
    'latitude', CASE 
        WHEN latitude ~ '^-?[0-9]+(\.[0-9]+)?$' THEN latitude::NUMERIC
        ELSE -18.9186 -- Coordenada padrão Uberlândia
    END,
    'longitude', CASE 
        WHEN longitude ~ '^-?[0-9]+(\.[0-9]+)?$' THEN longitude::NUMERIC
        ELSE -48.2772 -- Coordenada padrão Uberlândia
    END
)
WHERE coordenadas IS NULL;

-- 7.4 Migrar itens para formato estruturado
UPDATE pedido 
SET itens_estruturados = CASE
    -- Se items já é um JSON válido
    WHEN items ~ '^\[.*\]$' OR items ~ '^\{.*\}$' THEN 
        CASE 
            WHEN jsonb_typeof(items::jsonb) = 'array' THEN items::jsonb
            ELSE jsonb_build_array(items::jsonb)
        END
    -- Se items é uma string simples
    WHEN items IS NOT NULL AND items != '' THEN 
        jsonb_build_array(
            jsonb_build_object(
                'nome', items,
                'quantidade', 1,
                'preco_unitario', COALESCE(value, 0)
            )
        )
    -- Valor padrão
    ELSE jsonb_build_array(
        jsonb_build_object(
            'nome', 'Item não especificado',
            'quantidade', 1,
            'preco_unitario', COALESCE(value, 0)
        )
    )
END
WHERE itens_estruturados IS NULL;

-- 7.5 Migrar itens para tabela normalizada
INSERT INTO itens_pedido (pedido_id, nome, quantidade, preco_unitario)
SELECT 
    p.id as pedido_id,
    COALESCE(item->>'nome', 'Item não especificado') as nome,
    COALESCE((item->>'quantidade')::INTEGER, 1) as quantidade,
    COALESCE((item->>'preco_unitario')::DECIMAL, p.value, 0) as preco_unitario
FROM pedido p,
     jsonb_array_elements(p.itens_estruturados) as item
WHERE NOT EXISTS (
    SELECT 1 FROM itens_pedido ip WHERE ip.pedido_id = p.id
);

-- 7.6 Criar timeline inicial para pedidos existentes
INSERT INTO timeline_pedido (pedido_id, status_novo, timestamp_evento)
SELECT 
    id as pedido_id,
    CASE status_pedido
        WHEN 1 THEN 'disponivel'
        WHEN 2 THEN 'aceito'
        WHEN 3 THEN 'em_rota'
        WHEN 4 THEN 'entregue'
        WHEN 5 THEN 'cancelado'
        ELSE 'disponivel'
    END as status_novo,
    COALESCE(created_at, CURRENT_TIMESTAMP) as timestamp_evento
FROM pedido
WHERE NOT EXISTS (
    SELECT 1 FROM timeline_pedido tp WHERE tp.pedido_id = pedido.id
);

-- 8. CRIAR FOREIGN KEYS
DO $$
BEGIN
    -- FK pedido -> cliente
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_pedido_cliente') THEN
        ALTER TABLE pedido ADD CONSTRAINT fk_pedido_cliente 
        FOREIGN KEY (cliente_id) REFERENCES cliente(id);
    END IF;
    
    -- FK timeline_pedido -> pedido
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_timeline_pedido') THEN
        ALTER TABLE timeline_pedido ADD CONSTRAINT fk_timeline_pedido 
        FOREIGN KEY (pedido_id) REFERENCES pedido(id) ON DELETE CASCADE;
    END IF;
    
    -- FK itens_pedido -> pedido
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_itens_pedido') THEN
        ALTER TABLE itens_pedido ADD CONSTRAINT fk_itens_pedido 
        FOREIGN KEY (pedido_id) REFERENCES pedido(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 9. CRIAR ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_pedido_cliente_id ON pedido(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedido_status ON pedido(status_pedido);
CREATE INDEX IF NOT EXISTS idx_pedido_coordenadas ON pedido USING GIN(coordenadas);
CREATE INDEX IF NOT EXISTS idx_timeline_pedido_id ON timeline_pedido(pedido_id);
CREATE INDEX IF NOT EXISTS idx_timeline_status ON timeline_pedido(status_novo);
CREATE INDEX IF NOT EXISTS idx_itens_pedido_id ON itens_pedido(pedido_id);

-- 10. ATUALIZAR TIMESTAMPS
UPDATE pedido 
SET 
    created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
    updated_at = CURRENT_TIMESTAMP
WHERE created_at IS NULL OR updated_at IS NULL;

-- 11. VALIDAÇÕES FINAIS
DO $$
DECLARE
    total_pedidos INTEGER;
    pedidos_com_cliente INTEGER;
    pedidos_com_coordenadas INTEGER;
    pedidos_com_itens INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_pedidos FROM pedido;
    SELECT COUNT(*) INTO pedidos_com_cliente FROM pedido WHERE cliente_id IS NOT NULL;
    SELECT COUNT(*) INTO pedidos_com_coordenadas FROM pedido WHERE coordenadas IS NOT NULL;
    SELECT COUNT(*) INTO pedidos_com_itens FROM pedido WHERE itens_estruturados IS NOT NULL;
    
    RAISE NOTICE 'VALIDAÇÃO DA MIGRAÇÃO:';
    RAISE NOTICE 'Total de pedidos: %', total_pedidos;
    RAISE NOTICE 'Pedidos com cliente: %', pedidos_com_cliente;
    RAISE NOTICE 'Pedidos com coordenadas: %', pedidos_com_coordenadas;
    RAISE NOTICE 'Pedidos com itens estruturados: %', pedidos_com_itens;
    
    IF pedidos_com_cliente < total_pedidos THEN
        RAISE WARNING 'Alguns pedidos não foram associados a clientes!';
    END IF;
    
    IF pedidos_com_coordenadas < total_pedidos THEN
        RAISE WARNING 'Alguns pedidos não possuem coordenadas!';
    END IF;
END $$;

COMMIT;

RAISE NOTICE 'Migração concluída com sucesso!';
RAISE NOTICE 'Execute as consultas de validação para verificar os dados.';

-- =====================================================
-- CONSULTAS DE VALIDAÇÃO PÓS-MIGRAÇÃO
-- =====================================================

/*
-- Verificar estrutura das tabelas
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('pedido', 'cliente', 'timeline_pedido', 'itens_pedido')
ORDER BY table_name, ordinal_position;

-- Verificar dados migrados
SELECT 
    p.id,
    c.nome as cliente_nome,
    p.coordenadas,
    p.itens_estruturados,
    p.status_pedido
FROM pedido p
LEFT JOIN cliente c ON p.cliente_id = c.id
LIMIT 5;

-- Verificar timeline
SELECT * FROM timeline_pedido ORDER BY pedido_id, timestamp_evento LIMIT 10;

-- Verificar itens
SELECT * FROM itens_pedido LIMIT 10;

-- Verificar foreign keys
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('pedido', 'timeline_pedido', 'itens_pedido');
*/