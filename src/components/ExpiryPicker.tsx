import Ionicons from "@expo/vector-icons/Ionicons";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { TextInput } from "@/components/TextInput";

import { colors, fonts, isDark, radius, spacing } from "@/theme";
import { addDays, formatDate, fromIsoDate, relativeDays, toIsoDate } from "@/utils/dates";
import { tap, tick } from "@/utils/haptics";

// The "Use by" field on the Add and Edit forms. Tap it to pick a real date:
//   iPhone  → a scrolling date wheel opens under the field
//   Android → the phone's calendar pop-up
//   Web     → type the date (the native picker doesn't exist in a browser)
// `value` is "YYYY-MM-DD", or null for "no date".
export function ExpiryPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const [open, setOpen] = useState(false); // iPhone only: is the wheel showing?
  const [webText, setWebText] = useState(value ?? ""); // web only: what's typed so far

  // What the picker starts on: the chosen date, or a week from today if there isn't one
  const current = fromIsoDate(value ?? addDays(7));
  // Don't allow dates more than a year in the past (almost certainly a mis-scroll)
  const minimumDate = fromIsoDate(addDays(-365));

  function openPicker() {
    tap();
    if (Platform.OS === "android") {
      // Android: a pop-up dialog. Its OK button calls onChange with type "set".
      DateTimePickerAndroid.open({
        value: current,
        mode: "date",
        minimumDate,
        onChange: (event, date) => {
          if (event.type === "set" && date) onChange(toIsoDate(date));
        },
      });
    } else {
      setOpen((o) => !o); // iPhone: show or hide the wheel
      if (value === null) onChange(toIsoDate(current)); // opening it picks a date
    }
  }

  function clear() {
    tap();
    setOpen(false);
    onChange(null);
  }

  // ---- Web: a plain text box ----
  if (Platform.OS === "web") {
    return (
      <View style={styles.wrap}>
        <TextInput
          value={webText}
          onChangeText={(t) => {
            setWebText(t);
            if (t === "") onChange(null);
            else if (/^\d{4}-\d{2}-\d{2}$/.test(t)) onChange(t); // only once it's a full date
          }}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textSoft}
          style={styles.webInput}
        />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {/* ---- The field: shows the date, tap to change ---- */}
      <View style={[styles.field, open && styles.fieldOpen]}>
        <Pressable
          onPress={openPicker}
          style={styles.fieldMain}
          accessibilityRole="button"
          accessibilityLabel={value ? `Use by ${formatDate(value)}. Change date` : "Add a date"}
        >
          <View style={styles.iconBox}>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
          </View>
          {value === null ? (
            <Text style={styles.placeholder}>No date · tap to choose</Text>
          ) : (
            <View style={{ flex: 1 }}>
              <Text style={styles.dateText}>{formatDate(value)}</Text>
              <Text style={styles.relative}>{relativeDays(value)}</Text>
            </View>
          )}
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.textSoft} />
        </Pressable>
        {value !== null && (
          <Pressable
            onPress={clear}
            hitSlop={8}
            style={styles.clear}
            accessibilityRole="button"
            accessibilityLabel="Remove date"
          >
            <Ionicons name="close-circle" size={22} color={colors.textSoft} />
          </Pressable>
        )}
      </View>

      {/* ---- iPhone: the scrolling wheel, right under the field ---- */}
      {open && Platform.OS === "ios" && (
        <View style={styles.wheelCard}>
          <DateTimePicker
            value={current}
            mode="date"
            display="spinner"
            minimumDate={minimumDate}
            themeVariant={isDark ? "dark" : "light"}
            textColor={colors.text}
            onChange={(_event, date) => {
              if (date) {
                tick(); // a small tick as each wheel stops
                onChange(toIsoDate(date));
              }
            }}
          />
          <Pressable
            onPress={() => {
              tap();
              setOpen(false);
            }}
            style={({ pressed }) => [styles.done, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingRight: spacing.sm,
  },
  fieldOpen: { borderColor: colors.primary },
  fieldMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingLeft: spacing.sm + 2,
    paddingRight: spacing.sm,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholder: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.textSoft },
  dateText: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.text },
  relative: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft },
  clear: { padding: spacing.xs },
  wheelCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingBottom: spacing.md,
    alignItems: "center",
  },
  done: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl + 8,
  },
  doneText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPrimary },
  webInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
});
