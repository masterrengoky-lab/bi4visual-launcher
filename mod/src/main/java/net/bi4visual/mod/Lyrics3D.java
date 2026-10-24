package net.bi4visual.mod;

import com.mojang.blaze3d.vertex.PoseStack;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.ChatFormatting;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.network.chat.Component;
import net.minecraft.util.Mth;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.phys.Vec3;
import org.joml.Quaternionf;

/**
 * Lines of the playing song floating in front of the player. Each piece appears
 * where the player looks and stays at that spot, types in letter by letter with a
 * glow and a moving gradient, and rises and fades as the next one comes.
 */
public final class Lyrics3D {
    /** Packed light for "lit by sky and block light 15", same as LightTexture.FULL_BRIGHT. */
    public static final int FULL_BRIGHT = 0xF000F0;
    private static final int LIGHT = 0xF1E4FF;
    private static final int DEEP = 0xA77BFF;
    private static final int GLOW = 0x7A3CF0;
    private static final float DISTANCE = 14f;
    /** Blocks between the current line and the one before it. */
    private static final float LINE_GAP = 1.1f;
    private static final float PIXEL = 0.06f;
    private static final long LETTER = 28;
    private static final long LETTER_IN = 380;
    private static final long FADE_OUT = 900;
    /** A line with no next one (an instrumental part) goes away after this. */
    private static final long MAX_LIFE = 9000;

    private static final class Floating {
        final List<Component> letters = new ArrayList<>();
        final long born;
        long dying = Long.MAX_VALUE;
        /** Shift in blocks, so neighbouring pieces do not sit on one spot. */
        final float side;
        final float lift;
        /** Where the player looked when the piece appeared; it stays there. */
        final float yaw;
        final float pitch;

        Floating(String text, long born, float side, float lift, float yaw, float pitch) {
            this.side = side;
            this.lift = lift;
            this.yaw = yaw;
            this.pitch = pitch;
            text.codePoints().forEach(cp -> letters.add(Component.literal(new String(Character.toChars(cp))).withStyle(ChatFormatting.BOLD)));
            this.born = born;
        }
    }

    private static final List<Floating> shown = new ArrayList<>();
    private static String track = "";
    private static int lineIndex = -1;
    private static int pieceIndex = -1;
    private static int pieceCount;
    private static float viewYaw;
    private static float viewPitch;

    private Lyrics3D() {}

    /** Draws one letter; the game version decides how (see the backend's LevelRendererMixin). */
    public interface Sink {
        void letter(PoseStack pose, Component letter, float x, float y, int argb, boolean shadow);
    }

    /**
     * Updates and draws the lines.
     * @param applyView rotate by the camera ourselves, for backends that draw
     *                  after the level renderer has dropped its view matrix
     * @return false when there was nothing to draw
     */
    public static boolean render(Sink sink, boolean applyView) {
        Minecraft mc = Minecraft.getInstance();
        if (mc.level == null || mc.player == null) {
            return false;
        }
        long now = System.currentTimeMillis();
        Entity viewer = mc.player;
        // New pieces appear right in front, a little above the crosshair.
        viewYaw = viewer.getYRot();
        viewPitch = Mth.clamp(viewer.getXRot() - 6f, -80f, 80f);
        update(NowPlaying.get(), now);
        if (shown.isEmpty()) {
            return false;
        }


        // Same rotation the camera builds from the view angles (Camera#setRotation);
        // taken from the player because the camera's getters differ between versions.
        Quaternionf camera = new Quaternionf().rotationYXZ(
                -viewer.getYRot() * Mth.DEG_TO_RAD, viewer.getXRot() * Mth.DEG_TO_RAD, 0f);
        PoseStack pose = new PoseStack();
        if (applyView) {
            rotate(pose, new Quaternionf(camera).conjugate());
        }
        for (Floating line : shown) {
            draw(line, now, pose, sink, mc.font, camera);
        }
        return true;
    }

    private static void update(NowPlaying.Data np, long now) {
        String key = np == null ? "" : np.title + "\u0000" + np.artist;
        if (!key.equals(track)) {
            track = key;
            lineIndex = -1;
            // Show what is playing, also as a sign the mod sees the music.
            if (np != null && !np.title.isBlank()) {
                pieceCount = 0;
                spawn("\u266A " + (np.artist.isBlank() ? "" : np.artist + " \u2014 ") + np.title, now);
            } else {
                fadeAll(now);
            }
        }
        if (np != null && np.lines != null && !np.lines.isEmpty()) {
            long pos = np.position(now);
            int index = -1;
            for (int i = 0; i < np.lines.size() && np.lines.get(i).t <= pos; i++) {
                index = i;
            }
            String text = index >= 0 ? np.lines.get(index).text : "";
            List<String> pieces = text == null ? List.of() : pieces(text);
            int piece = -1;
            if (!pieces.isEmpty()) {
                // Spread the pieces over the time until the next line, like the words are sung.
                long start = np.lines.get(index).t;
                long next = index + 1 < np.lines.size() ? np.lines.get(index + 1).t : start + 4000;
                long span = Mth.clamp(next - start, 1200, 7000) * 8 / 10;
                int words = 0;
                int total = text.trim().split("\\s+").length;
                for (int j = 0; j < pieces.size(); j++) {
                    if (pos - start >= span * words / total) {
                        piece = j;
                    }
                    words += pieces.get(j).split(" ").length;
                }
            }
            if (index != lineIndex) {
                lineIndex = index;
                pieceIndex = -1;
                pieceCount = 0;
                if (pieces.isEmpty()) {
                    fadeAll(now);
                }
            }
            while (pieceIndex < piece) {
                pieceIndex++;
                spawn(pieces.get(pieceIndex), now);
            }
        }
        for (Floating line : shown) {
            if (line.dying == Long.MAX_VALUE && now - line.born > MAX_LIFE) {
                line.dying = now;
            }
        }
        shown.removeIf(line -> now - line.dying > FADE_OUT);
    }

    private static void fadeAll(long now) {
        for (Floating line : shown) {
            line.dying = Math.min(line.dying, now);
        }
    }

    /** Splits a line into pieces of 2-3 words, never leaving one word alone. */
    static List<String> pieces(String text) {
        String[] words = text.trim().split("\\s+");
        List<String> out = new ArrayList<>();
        if (words.length == 0 || words[0].isEmpty()) {
            return out;
        }
        int i = 0;
        while (i < words.length) {
            int left = words.length - i;
            int take = left <= 3 ? left : (left == 4 ? 2 : 3);
            out.add(String.join(" ", java.util.Arrays.copyOfRange(words, i, i + take)));
            i += take;
        }
        return out;
    }

    /** The new piece appears in front; older ones stay put and fade a moment later. */
    private static void spawn(String text, long now) {
        for (Floating line : shown) {
            line.dying = Math.min(line.dying, now + 500);
        }
        // Pieces of a line step right-down and left-up, the first one centred,
        // so a piece never lands on top of the one before it.
        int k = pieceCount++;
        float side = k == 0 ? 0f : (k % 2 == 1 ? 2.2f : -2.2f);
        float lift = k == 0 ? 0f : (k % 2 == 1 ? -LINE_GAP * 0.6f : LINE_GAP * 0.6f);
        shown.add(new Floating(text, now, side, lift, viewYaw, viewPitch));
        while (shown.size() > 4) {
            shown.remove(0);
        }
    }

    private static void draw(Floating line, long now, PoseStack pose, Sink sink, Font font, Quaternionf camera) {
        Vec3 dir = Vec3.directionFromRotation(line.pitch, line.yaw);
        long age = now - line.born;
        float out = line.dying == Long.MAX_VALUE ? 1f : 1f - Mth.clamp((now - line.dying) / (float) FADE_OUT, 0f, 1f);
        float outEase = easeInOut(out);
        if (outEase < 0.01f) {
            return;
        }

        pose.pushPose();
        pose.translate(dir.x * DISTANCE, dir.y * DISTANCE, dir.z * DISTANCE);
        rotate(pose, camera);
        // Pieces stay where they appeared; the offsets keep neighbours apart.
        pose.translate(line.side, line.lift, 0f);
        float scale = PIXEL * (1f + (1f - outEase) * 0.06f);
        pose.scale(scale, -scale, scale);

        int width = 0;
        for (Component c : line.letters) {
            width += font.width(c);
        }
        float x = -width / 2f;
        int n = line.letters.size();
        for (int i = 0; i < n; i++) {
            Component c = line.letters.get(i);
            int w = font.width(c);
            float t = Mth.clamp((age - i * LETTER) / (float) LETTER_IN, 0f, 1f);
            float alpha = easeOut(t) * outEase;
            int a = (int) (255 * alpha);
            if (a > 4) {
                float pop = 0.6f + 0.4f * easeOutBack(t);
                float y = (1f - easeOut(t)) * 6f;
                // A soft wave of colour running along the line.
                float wave = 0.5f + 0.5f * Mth.sin(i * 0.45f - age / 450f);
                int rgb = lerpColor(LIGHT, DEEP, wave);

                pose.pushPose();
                pose.translate(x + w / 2f, y + 4f, 0f);
                pose.scale(pop, pop, 1f);
                pose.translate(-w / 2f, -4f, 0f);
                int glow = ((int) (a * 0.22f) << 24) | GLOW;
                if (a * 0.22f > 4) {
                    for (float[] o : GLOW_OFFSETS) {
                        sink.letter(pose, c, o[0], o[1], glow, false);
                    }
                }
                sink.letter(pose, c, 0f, 0f, (a << 24) | rgb, false);
                pose.popPose();
            }
            x += w;
        }
        pose.popPose();
    }

    private static final float[][] GLOW_OFFSETS = {
        {-0.8f, 0f}, {0.8f, 0f}, {0f, -0.8f}, {0f, 0.8f},
        {-0.6f, -0.6f}, {0.6f, -0.6f}, {-0.6f, 0.6f}, {0.6f, 0.6f},
    };

    private static float easeInOut(float t) {
        return t * t * (3f - 2f * t);
    }

    private static float easeOutBack(float t) {
        float c = 1.4f;
        float u = t - 1f;
        return 1f + (c + 1f) * u * u * u + c * u * u;
    }

    /** PoseStack#mulPose(Quaternionf) is gone in 26.3; text needs no normals, so turn the matrix only. */
    private static void rotate(PoseStack pose, Quaternionf q) {
        pose.last().pose().rotate(q);
    }

    private static float easeOut(float t) {
        float u = 1f - t;
        return 1f - u * u * u;
    }

    private static int lerpColor(int a, int b, float t) {
        int r = (int) Mth.lerp(t, (a >> 16) & 0xFF, (b >> 16) & 0xFF);
        int g = (int) Mth.lerp(t, (a >> 8) & 0xFF, (b >> 8) & 0xFF);
        int bl = (int) Mth.lerp(t, a & 0xFF, b & 0xFF);
        return (r << 16) | (g << 8) | bl;
    }
}
