-- Script para criar tabela de distâncias dos pedidos
-- FASE 2.1 - Criar tabela distancia_pedido com campo distancia_km
-- Execute este script diretamente no PostgreSQL

BEGIN;

-- Criar tabela distancia_pedido
CREATE TABLE IF NOT EXISTS distancia_pedido (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES pedido(id) ON DELETE CASCADE,
    distancia_km DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    tempo_estimado_minutos INTEGER DEFAULT 0,
    rota_otimizada BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_distancia_pedido_pedido_id ON distancia_pedido(pedido_id);
CREATE INDEX IF NOT EXISTS idx_distancia_pedido_distancia ON distancia_pedido(distancia_km);

-- Popular com dados fictícios baseados nos pedidos existentes
INSERT INTO distancia_pedido (pedido_id, distancia_km, tempo_estimado_minutos, rota_otimizada)
SELECT 
    p.id as pedido_id,
    -- Gerar distâncias fictícias baseadas na localização (entre 0.5km e 25km)
    CASE 
        WHEN p.latitude IS NOT NULL AND p.longitude IS NOT NULL THEN
            ROUND((RANDOM() * 24.5 + 0.5)::numeric, 2)
        ELSE
            ROUND((RANDOM() * 15 + 2)::numeric, 2)
    END as distancia_km,
    -- Tempo estimado baseado na distância (aproximadamente 2-4 min por km)
    CASE 
        WHEN p.latitude IS NOT NULL AND p.longitude IS NOT NULL THEN
            ROUND((RANDOM() * 24.5 + 0.5) * (RANDOM() * 2 + 2))
        ELSE
            ROUND((RANDOM() * 15 + 2) * (RANDOM() * 2 + 2))
    END as tempo_estimado_minutos,
    -- 70% das rotas são otimizadas
    (RANDOM() > 0.3) as rota_otimizada
FROM pedido p
WHERE NOT EXISTS (
    SELECT 1 FROM distancia_pedido dp WHERE dp.pedido_id = p.id
);

-- Adicionar alguns dados específicos para pedidos conhecidos
UPDATE distancia_pedido SET 
    distancia_km = 3.2,
    tempo_estimado_minutos = 12,
    rota_otimizada = true
WHERE pedido_id = 1;

UPDATE distancia_pedido SET 
    distancia_km = 7.8,
    tempo_estimado_minutos = 25,
    rota_otimizada = true
WHERE pedido_id = 2;

UPDATE distancia_pedido SET 
    distancia_km = 1.5,
    tempo_estimado_minutos = 8,
    rota_otimizada = false
WHERE pedido_id = 3;

UPDATE distancia_pedido SET 
    distancia_km = 12.4,
    tempo_estimado_minutos = 35,
    rota_otimizada = true
WHERE pedido_id = 4;

UPDATE distancia_pedido SET 
    distancia_km = 5.6,
    tempo_estimado_minutos = 18,
    rota_otimizada = true
WHERE pedido_id = 5;

COMMIT;

-- Verificar os dados inseridos (execute separadamente após o COMMIT)
-- SELECT 
--     dp.pedido_id,
--     p.nome_cliente,
--     dp.distancia_km,
--     dp.tempo_estimado_minutos,
--     dp.rota_otimizada,
--     p.status_pedido
-- FROM distancia_pedido dp
-- JOIN pedido p ON dp.pedido_id = p.id
-- ORDER BY dp.pedido_id
-- LIMIT 10;