-- ADR 0011 7.2 (1/2): novo valor do enum. O CHECK que o cita fica na migration seguinte, porque o PostgreSQL
-- não permite usar um valor de enum na mesma transação em que ele foi criado.
ALTER TYPE "user_kind" ADD VALUE IF NOT EXISTS 'SHOWCASE';
