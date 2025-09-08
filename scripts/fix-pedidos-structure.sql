-- Script para corrigir a estrutura da tabela de pedidos
-- Cria views e funções para mapear dados da estrutura atual para a esperada

-- 1. View para mapear pedidos com estrutura correta
CREATE OR REPLACE VIEW pedidos_estruturados AS
SELECT 
    p.id,
    COALESCE(p.id_ifood, '') as id_ifood,
    COALESCE(p.motoboy_responsavel, 0) as id_estabelecimento,
    
    -- Objeto cliente estruturado
    JSON_BUILD_OBJECT(
        'id', p.id,
        'nome', COALESCE(p.nome_cliente, ''),
        'telefone', COALESCE(p.telefone_cliente, ''),
        'endereco', COALESCE(p.endereco_entrega, ''),
        'bairro', COALESCE(p.entrega_bairro, '')
    ) as cliente,
    
    -- Coordenadas estruturadas
    JSON_BUILD_OBJECT(
        'lat', CASE 
            WHEN p.latitude IS NOT NULL AND p.latitude != '' 
            THEN CAST(p.latitude AS DECIMAL)
            ELSE 0
        END,
        'lng', CASE 
            WHEN p.longitude IS NOT NULL AND p.longitude != '' 
            THEN CAST(p.longitude AS DECIMAL)
            ELSE 0
        END
    ) as coordinates,
    
    -- Itens estruturados
    CASE 
        -- Se items já é um JSON válido
        WHEN p.items LIKE '[%]' AND p.items LIKE '%}]' THEN 
            p.items::JSON
        -- Se items contém JSON de objeto único
        WHEN p.items LIKE '{%}' THEN 
            JSON_BUILD_ARRAY(p.items::JSON)
        -- Se items é string simples, criar estrutura
        ELSE 
            JSON_BUILD_ARRAY(
                JSON_BUILD_OBJECT(
                    'id', 1,
                    'nome', COALESCE(p.items, 'Item não especificado'),
                    'quantidade', 1,
                    'valor', COALESCE(p.value, 0),
                    'tipo', 'comida',
                    'observacoes', ''
                )
            )
    END as itens,
    
    -- Timeline vazia por enquanto
    JSON_BUILD_ARRAY() as timeline,
    
    -- Campos adicionais úteis
    p.status_pedido,
    p.value as valor_total,
    p.horario_pedido,
    p.data_pedido,
    p.tipo_pagamento,
    p.region
    
FROM pedido p;

-- 2. View para listagem resumida (compatível com PedidoResumo)
CREATE OR REPLACE VIEW pedidos_resumo AS
SELECT 
    p.id,
    COALESCE(p.nome_cliente, 'Cliente não informado') as cliente_nome,
    COALESCE(p.value, 0) as total_valor,
    CASE p.status_pedido
        WHEN 1 THEN 'disponivel'
        WHEN 2 THEN 'aceito'
        WHEN 3 THEN 'em_entrega'
        WHEN 4 THEN 'entregue'
        WHEN 5 THEN 'cancelado'
        ELSE 'disponivel'
    END as status,
    JSON_BUILD_OBJECT(
        'lat', CASE 
            WHEN p.latitude IS NOT NULL AND p.latitude != '' 
            THEN CAST(p.latitude AS DECIMAL)
            ELSE 0
        END,
        'lng', CASE 
            WHEN p.longitude IS NOT NULL AND p.longitude != '' 
            THEN CAST(p.longitude AS DECIMAL)
            ELSE 0
        END
    ) as coordinates
FROM pedido p;

-- 3. Função para buscar pedidos com filtros
CREATE OR REPLACE FUNCTION buscar_pedidos(
    p_status VARCHAR DEFAULT NULL,
    p_estabelecimento_id INTEGER DEFAULT NULL,
    p_page INTEGER DEFAULT 1,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    pedidos JSON,
    total INTEGER,
    page INTEGER,
    limit_param INTEGER,
    has_more BOOLEAN
) AS $$
DECLARE
    offset_val INTEGER;
    total_count INTEGER;
BEGIN
    -- Calcular offset
    offset_val := (p_page - 1) * p_limit;
    
    -- Contar total de registros
    SELECT COUNT(*) INTO total_count
    FROM pedidos_resumo pr
    WHERE (p_status IS NULL OR pr.status = p_status)
    AND (p_estabelecimento_id IS NULL OR TRUE); -- Ajustar quando tiver campo estabelecimento
    
    -- Retornar dados paginados
    RETURN QUERY
    SELECT 
        JSON_AGG(
            JSON_BUILD_OBJECT(
                'id', pr.id,
                'cliente_nome', pr.cliente_nome,
                'total_valor', pr.total_valor,
                'status', pr.status,
                'coordinates', pr.coordinates
            )
        ) as pedidos,
        total_count as total,
        p_page as page,
        p_limit as limit_param,
        (offset_val + p_limit < total_count) as has_more
    FROM (
        SELECT *
        FROM pedidos_resumo pr
        WHERE (p_status IS NULL OR pr.status = p_status)
        AND (p_estabelecimento_id IS NULL OR TRUE)
        ORDER BY pr.id DESC
        LIMIT p_limit OFFSET offset_val
    ) pr;
END;
$$ LANGUAGE plpgsql;

-- 4. Função para buscar pedido por ID
CREATE OR REPLACE FUNCTION buscar_pedido_por_id(p_id INTEGER)
RETURNS JSON AS $$
DECLARE
    resultado JSON;
BEGIN
    SELECT JSON_BUILD_OBJECT(
        'id', pe.id,
        'id_ifood', pe.id_ifood,
        'id_estabelecimento', pe.id_estabelecimento,
        'cliente', pe.cliente,
        'coordinates', pe.coordinates,
        'itens', pe.itens,
        'timeline', pe.timeline
    ) INTO resultado
    FROM pedidos_estruturados pe
    WHERE pe.id = p_id;
    
    RETURN resultado;
END;
$$ LANGUAGE plpgsql;

-- 5. Inserir alguns dados de teste se a tabela estiver vazia
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pedido WHERE nome_cliente IS NOT NULL LIMIT 1) THEN
        INSERT INTO pedido (
            nome_cliente, endereco_entrega, telefone_cliente, 
            status_pedido, value, latitude, longitude, items,
            entrega_bairro, tipo_pagamento, horario_pedido
        ) VALUES 
        (
            'Rafael Andrade', 
            'Alameda dos Mandarins, 500', 
            '(34) 99123-4567',
            1, -- disponivel
            32.00,
            '-18.906376273263426',
            '-48.215105388963835',
            '[{"nome":"X-Burguer","quantidade":1,"valor":18,"tipo":"comida"},{"nome":"Coca 2L","quantidade":1,"valor":10,"tipo":"bebida"},{"nome":"Batata Frita","quantidade":1,"valor":4,"tipo":"comida"}]',
            'Grand Ville',
            'Pix',
            '20:30'
        ),
        (
            'Maria Souza',
            'Av. Manuel Lúcio, 355',
            '(34) 99876-5432',
            1, -- disponivel
            15.00,
            '-18.910321782284516',
            '-48.21741885096243',
            '[{"nome":"Guaraná","quantidade":1,"valor":7,"tipo":"bebida"},{"nome":"Água","quantidade":2,"valor":4,"tipo":"bebida"}]',
            'Grand Ville',
            'Dinheiro',
            '19:22'
        ),
        (
            'João Pedro',
            'Av. Manuel Lúcio, 155',
            '(34) 99555-1234',
            1, -- disponivel
            8.00,
            '-18.90887126021788',
            '-48.21877699273963',
            '[{"nome":"Sprite","quantidade":1,"valor":8,"tipo":"bebida"}]',
            'Grand Ville',
            'Crédito',
            '20:00'
        );
        
        RAISE NOTICE 'Dados de teste inseridos com sucesso!';
    ELSE
        RAISE NOTICE 'Tabela já contém dados, pulando inserção de teste.';
    END IF;
END
$$;

-- 6. Testar as views criadas
SELECT 'Testando view pedidos_resumo:' as teste;
SELECT * FROM pedidos_resumo LIMIT 3;

SELECT 'Testando função buscar_pedidos:' as teste;
SELECT * FROM buscar_pedidos('disponivel', NULL, 1, 5);

SELECT 'Testando view pedidos_estruturados:' as teste;
SELECT id, cliente, coordinates, itens FROM pedidos_estruturados LIMIT 2;

SELECT 'Script executado com sucesso!' as resultado;