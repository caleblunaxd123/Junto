-- Last authenticated activity, so group members can see who is online ("en línea") or when they
-- were last seen. Additive; NULL until the person uses JUNTO again.
ALTER TABLE "usuarios" ADD COLUMN "ultima_conexion" TIMESTAMP(3);
