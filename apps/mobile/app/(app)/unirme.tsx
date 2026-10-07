import React, { useState } from "react";
import { TextInput } from "react-native";
import { router } from "expo-router";
import { Screen, Card, Label, Button, ErrorBox, palette, design } from "../../src/components/ui/Design";
import { extractInvitationCode } from "../../src/lib/invitation";

/** For people who installed the app after receiving the link: paste it here. */
export default function JoinWithLink() {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  function go() {
    const code = extractInvitationCode(text);
    if (!code) {
      setError("No encontramos un código de invitación. Copia el mensaje o el enlace completo que te enviaron.");
      return;
    }
    router.push({ pathname: "/unirse/[code]", params: { code } });
  }
  return (
    <Screen title="Unirme a un grupo" subtitle="Pega el enlace o el código que te compartieron." back>
      <Card>
        <TextInput
          accessibilityLabel="Enlace o código de invitación"
          value={text}
          onChangeText={(value) => {
            setText(value);
            setError("");
          }}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          multiline
          placeholder="https://junto.pe/unirse/…"
          placeholderTextColor={palette.muted}
          style={[design.input, { minHeight: 80, textAlignVertical: "top" }]}
          onSubmitEditing={go}
        />
        {!!error && <ErrorBox message={error} />}
        <Button title="Continuar" disabled={!text.trim()} onPress={go} />
      </Card>
      <Label size={13} color={palette.muted}>
        Antes de unirte verás el nombre del grupo. Unirte no registra ningún gasto ni pago.
      </Label>
    </Screen>
  );
}
