// Invitations by e-mail or phone wait for the invited person: tests accept them as that person.
async function acceptInvite(apiBase, token, grupoId) {
  const headers = { Authorization: `Bearer ${token}` };
  const list = await (await fetch(`${apiBase}/invitaciones`, { headers })).json();
  const invite = Array.isArray(list) && list.find((item) => item.grupo.id === grupoId);
  if (!invite) throw new Error(`No pending invitation to group ${grupoId}`);
  const response = await fetch(`${apiBase}/invitaciones/${invite.id}/aceptar`, { method: "POST", headers });
  if (response.status !== 200) throw new Error(`Accepting the invitation answered ${response.status}`);
}
module.exports = { acceptInvite };
