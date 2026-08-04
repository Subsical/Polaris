module.exports = {
metadata: {
  permission: "ManageGuild",
  name: "prunexp",
  description: "Remove XP entries for members below a minimum XP threshold (database prune).",
  args: [
    { type: "integer", name: "minxp", description: "Minimum XP to keep (prunes users with xp < minxp)", min: 0, max: 1000, required: true },
    { type: "bool", name: "confirm", description: "Set true to actually prune (otherwise shows a preview)", required: false },
  ]
},

async run(client, int, tools) {
  const minxp = int.options.get("minxp")?.value;
  const confirm = int.options.get("confirm")?.value === true;

  if (minxp === null || minxp === undefined || isNaN(Number(minxp)) || Number(minxp) < 0) {
    return tools.warn("Invalid minxp value.");
  }

  // 🚨 IMPORTANT FIX:
  // Your bug comes from this line in your version:
  //   tools.fetchSettings(int.member?.id)
  // That will not fetch the guild's users map, so you'll see "Total ranked entries: 1".
  // Fetch the guild doc directly like your /api/pruneMembers route does.
  const db = await client.db.fetch(int.guild.id, ["settings", "users", "info"]);
  if (!db || !db.settings) return tools.warn("*noData");
  else if (!tools.canManageServer(int.member, db.settings.manualPerms)) return tools.warn("*notMod");
  else if (!db.settings.enabled) return tools.warn("*xpDisabled");

  const usersObj = db.users || {};
  const entries = Object.entries(usersObj);

  let matches = 0;
  let kept = 0;

  for (const [, data] of entries) {
    const xp = Number(data?.xp || 0);
    if (xp < minxp) matches++;
    else kept++;
  }

  if (!confirm) {
    return int.reply(
      [
        `🧹 **XP prune preview**`,
        `Guild: **${int.guild.name}**`,
        `Threshold: prune users with **XP < ${tools.commafy(minxp)}**`,
        ``,
        `Total ranked entries: **${tools.commafy(entries.length)}**`,
        `Would be pruned: **${tools.commafy(matches)}**`,
        `Would remain: **${tools.commafy(kept)}**`,
        ``,
        `Run again with **confirm: true** to apply.`,
      ].join("\n")
    );
  }

  const newUsers = {};
  for (const [id, data] of entries) {
    const xp = Number(data?.xp || 0);
    if (xp >= minxp) newUsers[id] = data;
  }

  try {
    await client.db.update(int.guild.id, { $set: { users: newUsers, "info.lastUpdate": Date.now() } }).exec();
    return int.reply(
      `✅ Pruned **${tools.commafy(matches)}** user${matches === 1 ? "" : "s"} ` +
      `(kept **${tools.commafy(kept)}**) with threshold **${tools.commafy(minxp)} XP**.`
    );
  } catch (e) {
    console.error(e);
    return tools.warn("Something went wrong while pruning XP entries!");
  }
}
};