package fm.audenic.app;

import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "LrcReader")
public class LrcReaderPlugin extends Plugin {
    private static final String TAG = "LrcReaderPlugin";

    @PluginMethod
    public void findAndReadLrc(PluginCall call) {
        String audioPath = call.getString("audioPath");
        if (audioPath == null || audioPath.isEmpty()) {
            call.reject("INVALID_PATH", "audioPath is required");
            return;
        }

        try {
            Log.d(TAG, "Searching for .lrc for: " + audioPath);

            // Strategy 1: Exact match - swap extension
            String lrcPath = swapExtensionToLrc(audioPath);
            File lrcFile = new File(lrcPath);
            if (lrcFile.exists() && lrcFile.isFile() && lrcFile.canRead()) {
                String content = readFileAsUtf8(lrcFile);
                JSObject result = new JSObject();
                result.put("found", true);
                result.put("content", content);
                result.put("lrcPath", lrcPath);
                result.put("matchType", "exact");
                call.resolve(result);
                return;
            }

            // Strategy 2: Fuzzy search in same directory
            String fuzzyPath = fuzzySearchInDirectory(audioPath);
            if (fuzzyPath != null) {
                File fuzzyFile = new File(fuzzyPath);
                String content = readFileAsUtf8(fuzzyFile);
                JSObject result = new JSObject();
                result.put("found", true);
                result.put("content", content);
                result.put("lrcPath", fuzzyPath);
                result.put("matchType", "fuzzy");
                call.resolve(result);
                return;
            }

            // Strategy 3: Search known music directories
            String knownPath = searchKnownDirectories(audioPath);
            if (knownPath != null) {
                File knownFile = new File(knownPath);
                String content = readFileAsUtf8(knownFile);
                JSObject result = new JSObject();
                result.put("found", true);
                result.put("content", content);
                result.put("lrcPath", knownPath);
                result.put("matchType", "known_dir");
                call.resolve(result);
                return;
            }

            // Not found
            JSObject result = new JSObject();
            result.put("found", false);
            result.put("content", (String) null);
            result.put("lrcPath", (String) null);
            result.put("matchType", "none");
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "findAndReadLrc error: " + e.getMessage(), e);
            JSObject result = new JSObject();
            result.put("found", false);
            result.put("content", (String) null);
            result.put("lrcPath", (String) null);
            result.put("matchType", "error");
            call.resolve(result);
        }
    }

    private String swapExtensionToLrc(String audioPath) {
        int dotIndex = audioPath.lastIndexOf('.');
        if (dotIndex > 0) {
            return audioPath.substring(0, dotIndex) + ".lrc";
        }
        return audioPath + ".lrc";
    }

    private String fuzzySearchInDirectory(String audioPath) {
        File audioFile = new File(audioPath);
        File parentDir = audioFile.getParentFile();
        if (parentDir == null || !parentDir.exists()) return null;

        File[] lrcFiles = parentDir.listFiles((dir, name) -> name.toLowerCase().endsWith(".lrc"));
        if (lrcFiles == null || lrcFiles.length == 0) return null;

        String audioBaseName = stripExtension(audioFile.getName()).toLowerCase();
        String audioClean = audioBaseName.replaceAll("^\\d+[.\\-\\s]+", "").replaceAll("[^a-z0-9\\s]", "").trim();

        String bestMatch = null;
        int bestScore = 0;

        for (File lrcFile : lrcFiles) {
            String lrcBaseName = stripExtension(lrcFile.getName()).toLowerCase();
            String lrcClean = lrcBaseName.replaceAll("^\\d+[.\\-\\s]+", "").replaceAll("[^a-z0-9\\s]", "").trim();
            int score = wordMatchScore(audioClean, lrcClean);
            if (score > bestScore && score >= 2) {
                bestScore = score;
                bestMatch = lrcFile.getAbsolutePath();
            }
        }
        return bestMatch;
    }

    private String searchKnownDirectories(String audioPath) {
        File audioFile = new File(audioPath);
        String baseName = stripExtension(audioFile.getName());

        String[] knownDirs = new String[] {
            "/storage/emulated/0/snaptube/download/SnapTube Audio",
            "/storage/emulated/0/Music",
            "/storage/emulated/0/Download",
            "/storage/emulated/0/Downloads",
            "/storage/emulated/0/Lyrics",
            "/storage/emulated/0/lyrics"
        };

        for (String dirPath : knownDirs) {
            File dir = new File(dirPath);
            if (!dir.exists() || !dir.isDirectory()) continue;

            File candidate = new File(dir, baseName + ".lrc");
            if (candidate.exists() && candidate.canRead()) {
                return candidate.getAbsolutePath();
            }
        }
        return null;
    }

    private String readFileAsUtf8(File file) throws Exception {
        StringBuilder sb = new StringBuilder();
        try (FileInputStream fis = new FileInputStream(file);
             InputStreamReader isr = new InputStreamReader(fis, StandardCharsets.UTF_8);
             BufferedReader br = new BufferedReader(isr)) {

            br.mark(3);
            int firstChar = br.read();
            if (firstChar != 0xFEFF) {
                br.reset();
            }

            String line;
            while ((line = br.readLine()) != null) {
                sb.append(line).append("\n");
            }
        }
        return sb.toString();
    }

    private int wordMatchScore(String a, String b) {
        if (a.isEmpty() || b.isEmpty()) return 0;
        String[] wordsA = a.split("\\s+");
        String[] wordsB = b.split("\\s+");
        int matches = 0;
        for (String wa : wordsA) {
            if (wa.length() < 2) continue;
            for (String wb : wordsB) {
                if (wa.equals(wb)) {
                    matches++;
                    break;
                }
            }
        }
        return matches;
    }

    private String stripExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot > 0 ? filename.substring(0, dot) : filename;
    }

    @PluginMethod
    public void listLrcFiles(PluginCall call) {
        String directory = call.getString("directory");
        if (directory == null) {
            call.reject("INVALID_DIR", "directory is required");
            return;
        }
        try {
            File dir = new File(directory);
            if (!dir.exists() || !dir.isDirectory()) {
                JSObject r = new JSObject();
                r.put("files", new JSArray());
                call.resolve(r);
                return;
            }
            File[] lrcFiles = dir.listFiles((d, name) -> name.toLowerCase().endsWith(".lrc"));
            JSArray arr = new JSArray();
            if (lrcFiles != null) {
                for (File f : lrcFiles) {
                    arr.put(f.getAbsolutePath());
                }
            }
            JSObject r = new JSObject();
            r.put("files", arr);
            r.put("count", arr.length());
            call.resolve(r);
        } catch (Exception e) {
            call.reject("LIST_FAILED", e.getMessage());
        }
    }
}
