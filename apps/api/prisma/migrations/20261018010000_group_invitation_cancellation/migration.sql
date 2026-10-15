-- Closing a group revokes unanswered invitations without pretending the invitee rejected them.
ALTER TABLE "invitaciones" DROP CONSTRAINT "invitaciones_estado_check";
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_estado_check"
  CHECK ("estado" IN ('pendiente', 'aceptada', 'rechazada', 'cancelada'));
