import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, radii } from "../theme";
import { formatDate, getResult, getResultColor } from "../services/utils";
import { Card, Badge } from "./SharedUI";
import { useGameEdit } from "./GameEditProvider";
import { useAuth } from "../hooks/useAuth";
import type { Game } from "../types";

export function GameCard({ game }: { game: Game }) {
  const { viewGame, editGame } = useGameEdit();
  const { canEdit } = useAuth();
  const result = getResult(game);
  const color = getResultColor(result);
  const played = game.ourScore != null;
  const multi = (game.keeperAppearances?.length || 0) > 1;

  return (
    <TouchableOpacity onPress={() => played ? viewGame(game) : canEdit ? editGame(game) : null} activeOpacity={0.7}>
      <Card style={{ borderLeftWidth: 3, borderLeftColor: color }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={[s.resultBadge, { backgroundColor: result === "W" ? colors.accentDim : result === "L" ? colors.dangerDim : result === "D" ? colors.warnDim : colors.blueDim }]}>
              <Text style={[s.resultText, { color }]}>{result === "Upcoming" ? "—" : result === "D" ? "T" : result}</Text>
            </View>
            <View>
              <Text style={s.opponent}>vs {game.opponent}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                <Text style={s.dateText}>{formatDate(game.date)}{game.time ? ` • ${game.time}` : ""}</Text>
                {multi && <Badge color={colors.purple} bg={colors.purpleDim}>Split GK</Badge>}
              </View>
            </View>
          </View>
          {played ? (
            <Text style={[s.score, { color }]}>{game.ourScore} – {game.theirScore}</Text>
          ) : <Badge color={colors.blue} bg={colors.blueDim}>Upcoming</Badge>}
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  resultBadge: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  resultText: { fontWeight: "700", fontSize: 12, fontFamily: "monospace" },
  opponent: { fontWeight: "600", fontSize: 15, color: colors.text },
  dateText: { color: colors.textMuted, fontSize: 12 },
  score: { fontFamily: "monospace", fontSize: 22, fontWeight: "700" },
});
