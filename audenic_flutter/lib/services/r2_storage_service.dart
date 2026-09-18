import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class R2UploadResult {
  final bool ok;
  final String url;
  final String filename;
  final int size;
  final String message;

  const R2UploadResult({
    required this.ok,
    required this.url,
    required this.filename,
    required this.size,
    required this.message,
  });
}

class R2StorageService {
  static const String publicUrl = 'https://pub-c26084d7ca874fcda47de161be8ded27.r2.dev';
  static const String bucketName = 'mwijay-music';
  static const String endpoint = 'https://9fbb1d44dab6a24c1cfb6b38f63f1295.r2.cloudflarestorage.com';
  static const String accessKeyId = '8319f162b5fd474d3c3a2d9802fc6c21';
  static const String secretAccessKey = '6a9a2528145a1ac3209cd272bf45c7ec051465fa11e22e2f8ce1d733e148c310';

  // Cloudinary configuration
  static const String cloudinaryCloudName = 'xesr11j5';
  static const String cloudinaryApiKey = '497173236258687';
  static const String cloudinaryApiSecret = '7uTfqzfX-hdxrCDGPUszUBIxad8';

  static List<int> _hmacSha256(List<int> key, List<int> data) {
    final hmac = Hmac(sha256, key);
    return hmac.convert(data).bytes;
  }

  /// Upload file bytes to Cloudflare R2 bucket with AWS SigV4 signing
  static Future<R2UploadResult> uploadToR2({
    required Uint8List bytes,
    required String filename,
    String contentType = 'audio/mpeg',
  }) async {
    final cleanName = filename.replaceAll(RegExp(r'[^a-zA-Z0-9._-]'), '_');
    final objectKey = 'uploads/${DateTime.now().millisecondsSinceEpoch}_$cleanName';
    final targetPublicUrl = '$publicUrl/$objectKey';

    try {
      final now = DateTime.now().toUtc();
      final iso = now.toIso8601String().replaceAll(RegExp(r'[:-]'), '').split('.').first;
      final amzDate = '${iso}Z';
      final dateStamp = amzDate.substring(0, 8);
      const region = 'auto';
      const service = 's3';

      final host = Uri.parse(endpoint).host;
      final path = '/$bucketName/$objectKey';

      final payloadHash = sha256.convert(bytes).toString();

      final canonicalHeaders = 'host:$host\nx-amz-content-sha256:$payloadHash\nx-amz-date:$amzDate\n';
      const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
      final canonicalRequest = 'PUT\n$path\n\n$canonicalHeaders\n$signedHeaders\n$payloadHash';

      final credentialScope = '$dateStamp/$region/$service/aws4_request';
      final stringToSign = 'AWS4-HMAC-SHA256\n$amzDate\n$credentialScope\n${sha256.convert(utf8.encode(canonicalRequest))}';

      final kSecret = utf8.encode('AWS4$secretAccessKey');
      final kDate = _hmacSha256(kSecret, utf8.encode(dateStamp));
      final kRegion = _hmacSha256(kDate, utf8.encode(region));
      final kService = _hmacSha256(kRegion, utf8.encode(service));
      final kSigning = _hmacSha256(kService, utf8.encode('aws4_request'));
      final signature = Hmac(sha256, kSigning).convert(utf8.encode(stringToSign)).toString();

      final authHeader = 'AWS4-HMAC-SHA256 Credential=$accessKeyId/$credentialScope, SignedHeaders=$signedHeaders, Signature=$signature';
      final uploadUri = Uri.parse('https://$host$path');

      final response = await http.put(
        uploadUri,
        headers: {
          'Host': host,
          'x-amz-date': amzDate,
          'x-amz-content-sha256': payloadHash,
          'Authorization': authHeader,
          'Content-Type': contentType,
        },
        body: bytes,
      );

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return R2UploadResult(
          ok: true,
          url: targetPublicUrl,
          filename: cleanName,
          size: bytes.length,
          message: 'Uploaded successfully to Cloudflare R2 CDN!',
        );
      } else {
        return R2UploadResult(
          ok: false,
          url: '',
          filename: cleanName,
          size: bytes.length,
          message: 'Cloudflare R2 returned status ${response.statusCode}: ${response.body}',
        );
      }
    } catch (e) {
      debugPrint('[R2StorageService] Upload error: $e');
      return R2UploadResult(
        ok: false,
        url: '',
        filename: cleanName,
        size: bytes.length,
        message: e.toString(),
      );
    }
  }

  /// Upload image to Cloudinary CDN for fast transformation and thumbnails
  static Future<String?> uploadToCloudinary(Uint8List bytes, {String filename = 'artwork.jpg'}) async {
    try {
      final timestamp = (DateTime.now().millisecondsSinceEpoch ~/ 1000).toString();
      final sigString = 'timestamp=$timestamp$cloudinaryApiSecret';
      final signature = sha1.convert(utf8.encode(sigString)).toString();

      final uri = Uri.parse('https://api.cloudinary.com/v1_1/$cloudinaryCloudName/image/upload');
      final request = http.MultipartRequest('POST', uri)
        ..fields['api_key'] = cloudinaryApiKey
        ..fields['timestamp'] = timestamp
        ..fields['signature'] = signature
        ..files.add(http.MultipartFile.fromBytes('file', bytes, filename: filename));

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        return data['secure_url'] as String?;
      }
    } catch (e) {
      debugPrint('[R2StorageService] Cloudinary upload error: $e');
    }
    return null;
  }
}
