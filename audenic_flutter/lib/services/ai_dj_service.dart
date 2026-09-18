import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:google_generative_ai/google_generative_ai.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../data/models/track.dart';

class AiDjService {
  static const String _prefKeyGemini = 'audenic_gemini_api_key';

  // Multi-Key Pool for resilient rotation across quota limits
  static const List<String> _defaultKeyPool = [
    "AIzaSyDOJWXl4cU5fNh0duUVXM54Kq-siinlDx8",
    "AIzaSyC38tz8RQGIaty1eTd_brhMM0CW1ul09RA",
    "AIzaSyBJsR0M86a7PexftlJBzWJFjm7Urgim7r0",
    "AIzaSyA-Y7euSTUORimWgUg8p5EZ5-_vkIQ6j1M",
    "AIzaSyB-3zf49AAPNC07hn_XBAmlQ150qn2WZnM",
  ];

  int _currentKeyIndex = 0;
  String? _customUserKey;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_prefKeyGemini);
    if (saved != null && saved.trim().isNotEmpty) {
      _customUserKey = saved.trim();
    }
  }

  Future<void> setApiKey(String key) async {
    _customUserKey = key.trim().isNotEmpty ? key.trim() : null;
    final prefs = await SharedPreferences.getInstance();
    if (_customUserKey != null) {
      await prefs.setString(_prefKeyGemini, _customUserKey!);
    } else {
      await prefs.remove(_prefKeyGemini);
    }
  }

  bool get hasCustomKey => _customUserKey != null && _customUserKey!.isNotEmpty;
  String? get apiKey => _customUserKey;

  String get _activeApiKey {
    if (_customUserKey != null) return _customUserKey!;
    return _defaultKeyPool[_currentKeyIndex % _defaultKeyPool.length];
  }

  void _rotateKey() {
    if (_customUserKey == null && _defaultKeyPool.isNotEmpty) {
      _currentKeyIndex = (_currentKeyIndex + 1) % _defaultKeyPool.length;
      debugPrint('[AiDjService] Rotated Gemini Key to index $_currentKeyIndex');
    }
  }

  Future<T> _executeWithRetry<T>(
    Future<T> Function(GenerativeModel model) action, {
    int maxRetries = 4,
  }) async {
    int attempts = 0;
    while (attempts < maxRetries) {
      try {
        final model = GenerativeModel(
          model: 'gemini-1.5-flash',
          apiKey: _activeApiKey,
          generationConfig: GenerationConfig(
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          ),
        );
        return await action(model);
      } catch (e) {
        attempts++;
        debugPrint('[AiDjService] Gemini request failed (attempt $attempts/$maxRetries): $e');
        _rotateKey();
        if (attempts >= maxRetries) {
          rethrow;
        }
      }
    }
    throw Exception("All Gemini API keys in the pool were exhausted or failed.");
  }

  /// Generate energetic radio DJ commentary introducing a track
  Future<String> generateDjIntro(Track track) async {
    try {
      return await _executeWithRetry((model) async {
        final prompt = '''
You are an energetic, charismatic radio DJ for "Audenic Music".
Give a short, punchy 1 to 2 sentence radio intro for the song "${track.title}" by ${track.artist}.
Make it sound hype, professional, and exciting. Do not use quotation marks.
''';
        final response = await model.generateContent([Content.text(prompt)]);
        return response.text?.trim() ?? 'Next up: "${track.title}" by ${track.artist}!';
      });
    } catch (e) {
      return 'Now playing "${track.title}" by ${track.artist} on Audenic.';
    }
  }

  /// Deep dive into song meaning, musical style, and production
  Future<String> explainSong({
    required String title,
    required String artist,
    String? lyrics,
  }) async {
    try {
      return await _executeWithRetry((model) async {
        final prompt = '''
Analyze the song "$title" by $artist for Audenic Music listeners.
Provide:
1. Meaning & Core Theme (1-2 paragraphs)
2. Musical Style & Production Highlights
3. Cultural Impact or Interesting Trivia

${lyrics != null && lyrics.isNotEmpty ? "Lyrics excerpt:\n$lyrics" : ""}
Keep the formatting clean, elegant, and engaging.
''';
        final response = await model.generateContent([Content.text(prompt)]);
        return response.text ?? "Unable to analyze this song right now.";
      });
    } catch (e) {
      return 'Could not generate song analysis at this time.';
    }
  }

  /// Suggest vibe playlist description and EQ tips
  Future<String> getVibeRecommendation(String mood) async {
    try {
      return await _executeWithRetry((model) async {
        final prompt = '''
The user wants music for the vibe: "$mood".
In 2 concise bullet points:
1. Describe the musical elements (tempo, instruments) that fit this vibe.
2. Recommend an equalizer profile (e.g. Bass Boost for workout, Flat for acoustic, Vocal Boost for podcasts).
''';
        final response = await model.generateContent([Content.text(prompt)]);
        return response.text?.trim() ?? 'Vibe profile active for "$mood".';
      });
    } catch (e) {
      return 'Vibe selected: $mood.';
    }
  }

  /// Generates a structured playlist from a user's prompt or mood
  Future<List<Map<String, String>>> generatePlaylist({
    required String prompt,
    int count = 6,
  }) async {
    try {
      return await _executeWithRetry((model) async {
        final instruction = '''
Create a curated playlist of $count real tracks matching this request: "$prompt".
Respond ONLY with a valid JSON array of objects, with keys "title" and "artist".
No markdown formatting, no code blocks, only raw JSON.
Example:
[{"title": "Blinding Lights", "artist": "The Weeknd"}, {"title": "Starboy", "artist": "The Weeknd"}]
''';
        final response = await model.generateContent([Content.text(instruction)]);
        final rawText = response.text?.trim() ?? "[]";

        String cleanJson = rawText;
        if (cleanJson.startsWith("```json")) {
          cleanJson = cleanJson.substring(7);
        } else if (cleanJson.startsWith("```")) {
          cleanJson = cleanJson.substring(3);
        }
        if (cleanJson.endsWith("```")) {
          cleanJson = cleanJson.substring(0, cleanJson.length - 3);
        }
        cleanJson = cleanJson.trim();

        final decoded = jsonDecode(cleanJson);
        if (decoded is List) {
          return decoded.map<Map<String, String>>((item) {
            return {
              "title": item["title"]?.toString() ?? "",
              "artist": item["artist"]?.toString() ?? "",
            };
          }).where((e) => e["title"]!.isNotEmpty).toList();
        }
        return [];
      });
    } catch (e) {
      debugPrint('[AiDjService] Playlist generation error: $e');
      return [];
    }
  }

  /// Conversational music companion
  Future<String> chat({
    required String message,
    List<Map<String, String>> history = const [],
    Map<String, dynamic>? currentTrackContext,
  }) async {
    return _executeWithRetry((model) async {
      final systemPrompt = """
You are Audenic AI, the intelligent, sleek, and knowledgeable music companion for Audenic Music (engineered by Mwijay Tech).
Your vibe is modern, energetic, music-obsessed, and helpful.
Current Now Playing Context:
${currentTrackContext != null ? jsonEncode(currentTrackContext) : "No song is currently playing."}

Rules:
1. Always be concise, clear, and passionate about music.
2. If the user asks for music recommendations, give 3-5 specific songs with artist names.
3. If the user asks about the current track, explain its context, genre, and significance.
4. Format song titles clearly like: "Track Name" by Artist.
""";

      final contents = <Content>[
        Content.text(systemPrompt),
        ...history.map((h) => h["role"] == "user"
            ? Content.text(h["content"] ?? "")
            : Content.model([TextPart(h["content"] ?? "")])),
        Content.text(message),
      ];

      final response = await model.generateContent(contents);
      return response.text ?? "I couldn't generate a response. Please try again.";
    });
  }
}
