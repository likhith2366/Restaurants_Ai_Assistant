import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";

// BottomSheetTextInput calls TextInput.State.currentlyFocusedInput on blur,
// which react-native-web doesn't expose. Use the plain TextInput on web —
// there's no virtual keyboard to scroll around, so we don't need the special
// integration anyway.
const SheetInput: typeof BottomSheetTextInput =
  Platform.OS === "web"
    ? (TextInput as unknown as typeof BottomSheetTextInput)
    : BottomSheetTextInput;
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Haptics } from "@/util/haptics";
import {
  isVoiceSupported,
  startListening,
  type VoiceSession,
} from "@/util/voice";
import { notify } from "@/util/dialog";
import { useChatStore, type ChatBubble } from "@/stores/chat";

export type ChatSheetRef = {
  open: () => void;
  close: () => void;
};

export const ChatSheet = forwardRef<ChatSheetRef, {}>((_, ref) => {
  const sheet = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["85%"], []);
  const [input, setInput] = useState("");
  const listRef = useRef<any>(null);

  // Voice input state. `listening` toggles the mic UI; `partial` is the
  // interim transcript shown live so the user can see they were heard.
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState("");
  const voiceRef = useRef<VoiceSession | null>(null);
  const voiceAvailable = useMemo(() => isVoiceSupported(), []);

  const bubbles = useChatStore((s) => s.bubbles);
  const sending = useChatStore((s) => s.sending);
  const send = useChatStore((s) => s.send);
  const suggestions = useChatStore((s) => s.suggestions);

  // Imperative handle so the parent can open/close from its FAB.
  useEffect(() => {
    if (typeof ref === "function") {
      ref({
        open: () => sheet.current?.expand(),
        close: () => sheet.current?.close(),
      });
    } else if (ref) {
      ref.current = {
        open: () => sheet.current?.expand(),
        close: () => sheet.current?.close(),
      };
    }
  }, [ref]);

  // Auto-scroll to bottom whenever bubbles change.
  useEffect(() => {
    if (!listRef.current) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToEnd?.({ animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [bubbles.length, bubbles[bubbles.length - 1]?.content]);

  const onSend = useCallback(
    async (text?: string) => {
      const value = (text ?? input).trim();
      if (!value || sending) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setInput("");
      Keyboard.dismiss();
      await send(value);
    },
    [input, sending, send],
  );

  const stopVoice = useCallback(() => {
    voiceRef.current?.stop();
    voiceRef.current = null;
    setListening(false);
    setPartial("");
  }, []);

  const startVoice = useCallback(() => {
    if (listening || sending) return;
    if (!voiceAvailable) {
      notify(
        "Voice not supported",
        "Your browser doesn't expose the Web Speech API. Try Chrome or Edge on desktop / Android.",
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setListening(true);
    setPartial("");
    voiceRef.current = startListening({
      onPartial: (t) => setPartial(t),
      onFinal: (t) => {
        setListening(false);
        setPartial("");
        voiceRef.current = null;
        // Auto-send what the user dictated.
        onSend(t);
      },
      onError: (err) => {
        setListening(false);
        setPartial("");
        voiceRef.current = null;
        // Surface the error so the user knows what's wrong.
        const messages: Record<string, string> = {
          "not-allowed": "Microphone permission was denied. Click the 🔒 icon in your browser's address bar → Site settings → allow microphone, then reload.",
          "service-not-allowed": "Microphone is blocked at the OS level. Check your system privacy settings.",
          "no-speech": "I didn't catch anything — try again and speak after the beep.",
          "audio-capture": "No microphone detected. Make sure one is connected and selected as the input device.",
          "network": "Speech recognition needs an internet connection (it uses a cloud service).",
          "aborted": "Listening was cancelled.",
          "not-supported": "Voice isn't supported in this browser.",
          "voice-start-failed": "Couldn't start listening. The page may need a reload.",
        };
        const message = messages[err] ?? `Voice error: ${err}`;
        notify("Voice unavailable", message);
      },
      onEnd: () => {
        // If the API ends with no final result (silence), just clear state.
        setListening(false);
        setPartial("");
        voiceRef.current = null;
      },
    });
  }, [listening, sending, voiceAvailable, onSend]);

  // Make sure we stop listening if the sheet unmounts mid-session.
  useEffect(() => () => voiceRef.current?.cancel(), []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.7}
      />
    ),
    [],
  );

  const showSuggestions = bubbles.length <= 1 && !sending;

  return (
    <BottomSheet
      ref={sheet}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: "#16110C" }}
      handleIndicatorStyle={{ backgroundColor: "#3A2F23", width: 56 }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      <View className="px-5 pt-1 pb-3 border-b border-ink-700/60 flex-row items-center">
        <View className="w-9 h-9 rounded-full bg-gold-500/15 border border-gold-500/40 items-center justify-center mr-3">
          <Ionicons name="sparkles" size={18} color="#E5B16A" />
        </View>
        <View className="flex-1">
          <Text className="text-cream-50 font-display text-xl">Bistro</Text>
          <Text className="text-cream-400 font-sans text-xs">
            Conversational ordering
          </Text>
        </View>
        <Pressable
          onPress={() => sheet.current?.close()}
          hitSlop={12}
          className="w-9 h-9 rounded-full bg-ink-700 items-center justify-center"
        >
          <Ionicons name="close" size={20} color="#A39788" />
        </Pressable>
      </View>

      <BottomSheetFlatList
        ref={listRef as any}
        data={bubbles}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 }}
        renderItem={({ item }) => <Bubble bubble={item} />}
      />

      {showSuggestions ? (
        <View className="px-4 pb-3">
          <Text className="text-cream-500 font-sansMed text-[11px] uppercase tracking-wider mb-2 px-1">
            Try saying
          </Text>
          <View className="flex-row flex-wrap">
            {suggestions.map((s) => (
              <Pressable
                key={s}
                onPress={() => onSend(s)}
                className="bg-ink-700 border border-ink-500 rounded-full px-3 py-2 mr-2 mb-2 active:opacity-80"
              >
                <Text className="text-cream-200 font-sans text-xs">{s}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View className="px-4 pb-5 pt-3 border-t border-ink-700/60 bg-ink-800">
        {listening ? (
          <View className="flex-row items-center mb-2 px-1">
            <ListeningPulse />
            <Text className="text-cream-200 font-sansMed text-xs ml-2 flex-1" numberOfLines={1}>
              {partial || "Listening…"}
            </Text>
            <Pressable
              onPress={stopVoice}
              hitSlop={8}
              className="px-2 py-1 rounded-full border border-ink-500"
            >
              <Text className="text-cream-300 font-sansMed text-[11px] uppercase tracking-wider">
                Stop
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View className="flex-row items-end bg-ink-700 rounded-2xl px-4 py-3 border border-ink-500">
          <SheetInput
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => onSend()}
            returnKeyType="send"
            placeholder={listening ? "Listening… speak now" : "Tell me what you'd like…"}
            placeholderTextColor="#7B7060"
            multiline
            editable={!listening}
            style={{
              flex: 1,
              color: "#FBF6EE",
              fontFamily: "Inter_400Regular",
              fontSize: 15,
              paddingTop: 2,
              paddingBottom: 2,
              maxHeight: 100,
            }}
          />

          {/* Mic button — hidden when there's text to send or when unsupported */}
          {voiceAvailable && !input.trim() ? (
            <Pressable
              onPress={listening ? stopVoice : startVoice}
              disabled={sending}
              className={`ml-2 w-10 h-10 rounded-full items-center justify-center border ${
                listening
                  ? "bg-ember-500 border-ember-500"
                  : "bg-ink-600 border-ink-500"
              }`}
            >
              <Ionicons
                name={listening ? "stop" : "mic"}
                size={18}
                color={listening ? "#FBF6EE" : "#E7D8BF"}
              />
            </Pressable>
          ) : null}

          {/* Send button — only shown when there's input */}
          {(input.trim() || sending) ? (
            <Pressable
              onPress={() => onSend()}
              disabled={!input.trim() || sending}
              className={`ml-2 w-10 h-10 rounded-full items-center justify-center ${
                input.trim() && !sending ? "bg-gold-500" : "bg-ink-600"
              }`}
            >
              {sending ? (
                <ActivityIndicator color="#0E0B08" />
              ) : (
                <Ionicons name="arrow-up" size={20} color={input.trim() ? "#0E0B08" : "#7B7060"} />
              )}
            </Pressable>
          ) : null}
        </View>
      </View>
    </BottomSheet>
  );
});

ChatSheet.displayName = "ChatSheet";

function ListeningPulse() {
  const s = useSharedValue(0);
  useEffect(() => {
    s.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [s]);
  const dotStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + s.value * 0.45,
    transform: [{ scale: 1 + s.value * 0.25 }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.6 - s.value * 0.6,
    transform: [{ scale: 1 + s.value * 1.2 }],
  }));
  return (
    <View style={{ width: 14, height: 14, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={[
          { position: "absolute", width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: "#D14A2A" },
          ringStyle,
        ]}
      />
      <Animated.View
        style={[
          { width: 8, height: 8, borderRadius: 4, backgroundColor: "#D14A2A" },
          dotStyle,
        ]}
      />
    </View>
  );
}

function Bubble({ bubble }: { bubble: ChatBubble }) {
  if (bubble.role === "user") {
    return (
      <View className="self-end max-w-[82%] mb-3 bg-gold-500 rounded-2xl rounded-tr-md px-4 py-3">
        <Text className="text-ink-900 font-sansMed text-[15px] leading-snug">
          {bubble.content}
        </Text>
      </View>
    );
  }
  return (
    <View className="self-start max-w-[88%] mb-3">
      {bubble.pending ? (
        <View className="bg-ink-700 border border-ink-500 rounded-2xl rounded-tl-md px-4 py-3">
          <TypingDots />
        </View>
      ) : (
        <>
          <View className="bg-ink-700 border border-ink-500 rounded-2xl rounded-tl-md px-4 py-3">
            <Text className="text-cream-100 font-sans text-[15px] leading-snug">
              {bubble.content}
            </Text>
          </View>
          {bubble.chips && bubble.chips.length > 0 ? (
            <View className="flex-row flex-wrap mt-2">
              {bubble.chips.map((c) => (
                <View
                  key={c}
                  className="bg-gold-500/10 border border-gold-500/30 rounded-full px-2.5 py-1 mr-1.5 mb-1.5"
                >
                  <Text className="text-gold-400 font-sansMed text-[11px]">
                    {c}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

function TypingDot({ delay }: { delay: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    const cfg = { duration: 600, easing: Easing.inOut(Easing.quad) };
    const t = setTimeout(() => {
      v.value = withRepeat(withTiming(1, cfg), -1, true);
    }, delay);
    return () => clearTimeout(t);
  }, [v, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + v.value * 0.6,
    transform: [{ translateY: -v.value * 3 }],
  }));
  return (
    <Animated.View
      style={[
        { width: 6, height: 6, borderRadius: 3, backgroundColor: "#C9B79A" },
        style,
      ]}
    />
  );
}

function TypingDots() {
  return (
    <View className="flex-row items-center gap-1.5 py-0.5">
      <TypingDot delay={0} />
      <TypingDot delay={150} />
      <TypingDot delay={300} />
    </View>
  );
}
