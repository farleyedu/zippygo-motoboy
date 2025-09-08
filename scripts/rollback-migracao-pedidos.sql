-- =====================================================
-- SCRIPT DE ROLLBACK DA MIGRAÇÃO DE PEDIDOS
-- Reverte todas as alterações da migração do schema
-- =====================================================

BEGIN;

RAISE NOTICE 'Iniciando rollback da migração de pedidos...';

-- 1. VERIFICAR SE O BACKUP EXISTE
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pedido_backup') THEN
        RAISE EXCEPTION 'Tabela de backup pedido_backup não encontrada! Rollback não pode ser executado com segurança.';
    END IF;
    
    RAISE NOTICE 'Backup encontrado. Prosseguindo com rollback...';
END $$;

-- 2. REMOVER FOREIGN KEYS
DO $$
BEGIN
    -- Remover FK pedido -> cliente
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_pedido_cliente') THEN
        ALTER TABLE pedido DROP CONSTRAINT fk_pedido_cliente;
        RAISE NOTICE 'Foreign key fk_pedido_cliente removida';
    END IF;
    
    -- Remover FK timeline_pedido -> pedido
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_timeline_pedido') THEN
        ALTER TABLE timeline_pedido DROP CONSTRAINT fk_timeline_pedido;
        RAISE NOTICE 'Foreign key fk_timeline_pedido removida';
    END IF;
    
    -- Remover FK itens_pedido -> pedido
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_itens_pedido') THEN
        ALTER TABLE itens_pedido DROP CONSTRAINT fk_itens_pedido;
        RAISE NOTICE 'Foreign key fk_itens_pedido removida';
    END IF;
END $$;

-- 3. REMOVER ÍNDICES CRIADOS NA MIGRAÇÃO
DROP INDEX IF EXISTS idx_pedido_cliente_id;
DROP INDEX IF EXISTS idx_pedido_coordenadas;
DROP INDEX IF EXISTS idx_timeline_pedido_id;
DROP INDEX IF EXISTS idx_timeline_status;
DROP INDEX IF EXISTS idx_itens_pedido_id;
RAISE NOTICE 'Índices da migração removidos';

-- 4. REMOVER TABELAS CRIADAS NA MIGRAÇÃO
DROP TABLE IF EXISTS timeline_pedido CASCADE;
RAISE NOTICE 'Tabela timeline_pedido removida';

DROP TABLE IF EXISTS itens_pedido CASCADE;
RAISE NOTICE 'Tabela itens_pedido removida';

DROP TABLE IF EXISTS cliente CASCADE;
RAISE NOTICE 'Tabela cliente removida';

-- 5. REMOVER COLUNAS ADICIONADAS À TABELA PEDIDO
DO $$
BEGIN
    -- Remover cliente_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedido' AND column_name = 'cliente_id') THEN
        ALTER TABLE pedido DROP COLUMN cliente_id;
        RAISE NOTICE 'Coluna cliente_id removida';
    END IF;
    
    -- Remover coordenadas
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedido' AND column_name = 'coordenadas') THEN
        ALTER TABLE pedido DROP COLUMN coordenadas;
        RAISE NOTICE 'Coluna coordenadas removida';
    END IF;
    
    -- Remover itens_estruturados
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedido' AND column_name = 'itens_estruturados') THEN
        ALTER TABLE pedido DROP COLUMN itens_estruturados;
        RAISE NOTICE 'Coluna itens_estruturados removida';
    END IF;
    
    -- Remover created_at (se não existia antes)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedido' AND column_name = 'created_at') THEN
        -- Verificar se a coluna existia no backup
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedido_backup' AND column_name = 'created_at') THEN
            ALTER TABLE pedido DROP COLUMN created_at;
            RAISE NOTICE 'Coluna created_at removida';
        END IF;
    END IF;
    
    -- Remover updated_at (se não existia antes)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedido' AND column_name = 'updated_at') THEN
        -- Verificar se a coluna existia no backup
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedido_backup' AND column_name = 'updated_at') THEN
            ALTER TABLE pedido DROP COLUMN updated_at;
            RAISE NOTICE 'Coluna updated_at removida';
        END IF;
    END IF;
END $$;

-- 6. RESTAURAR DADOS ORIGINAIS DO BACKUP
-- Primeiro, limpar dados atuais
TRUNCATE TABLE pedido;
RAISE NOTICE 'Dados atuais da tabela pedido removidos';

-- Restaurar dados do backup
INSERT INTO pedido SELECT * FROM pedido_backup;
RAISE NOTICE 'Dados originais restaurados do backup';

-- 7. REMOVER TABELA DE BACKUP
DROP TABLE IF EXISTS pedido_backup;
RAISE NOTICE 'Tabela de backup removida';

-- 8. RECRIAR ÍNDICES ORIGINAIS (se necessário)
-- Verificar se o índice original de status existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_pedido_status') THEN
        CREATE INDEX idx_pedido_status ON pedido(status_pedido);
        RAISE NOTICE 'Índice original idx_pedido_status recriado';
    END IF;
END $$;

-- 9. VALIDAÇÕES PÓS-ROLLBACK
DO $$
DECLARE
    total_pedidos INTEGER;
    colunas_extras INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_pedidos FROM pedido;
    
    -- Verificar se ainda existem colunas da migração
    SELECT COUNT(*) INTO colunas_extras 
    FROM information_schema.columns 
    WHERE table_name = 'pedido' 
        AND column_name IN ('cliente_id', 'coordenadas', 'itens_estruturados');
    
    RAISE NOTICE 'VALIDAÇÃO DO ROLLBACK:';
    RAISE NOTICE 'Total de pedidos restaurados: %', total_pedidos;
    RAISE NOTICE 'Colunas da migração restantes: %', colunas_extras;
    
    IF colunas_extras > 0 THEN
        RAISE WARNING 'Algumas colunas da migração ainda existem!';
    ELSE
        RAISE NOTICE 'Rollback executado com sucesso!';
    END IF;
    
    -- Verificar se tabelas da migração foram removidas
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name IN ('cliente', 'timeline_pedido', 'itens_pedido')) THEN
        RAISE WARNING 'Algumas tabelas da migração ainda existem!';
    ELSE
        RAISE NOTICE 'Todas as tabelas da migração foram removidas';
    END IF;
END $$;

COMMIT;

RAISE NOTICE 'Rollback da migração concluído!';
RAISE NOTICE 'A tabela pedido foi restaurada ao estado original.';

-- =====================================================
-- CONSULTAS DE VALIDAÇÃO PÓS-ROLLBACK
-- =====================================================

/*
-- Verificar estrutura da tabela pedido após rollback
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'pedido'
ORDER BY ordinal_position;

-- Verificar se tabelas da migração foram removidas
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('cliente', 'timeline_pedido', 'itens_pedido', 'pedido_backup')
AND table_schema = 'public';

-- Verificar dados restaurados
SELECT COUNT(*) as total_pedidos FROM pedido;
SELECT * FROM pedido LIMIT 5;

-- Verificar foreign keys (não devem existir)
SELECT constraint_name, table_name
FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY'
AND table_name = 'pedido';
*/