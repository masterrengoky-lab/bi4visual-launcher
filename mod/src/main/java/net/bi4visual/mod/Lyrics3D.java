package net.bi4visual.mod;

import com.mojang.blaze3d.vertex.PoseStack;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.network.chat.Component;
import net.minecraft.util.Mth;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.phys.Vec3;
import org.joml.Matrix3f;
import org.joml.Quaternionf;
import org.joml.Vector3f;

/**
 * Lines of the playing song in the sky around the player. Each piece of two or
 * three words is laid along an arc around the player, tilted at a random angle;
 * its letters fly in one by one from further out, glow, and drift away when the
 * next pieces come.
 */
public final class Lyrics3D {
    /** Packed light for "lit by sky and block light 15", same as LightTexture.FULL_BRIGHT. */
    public static final int FULL_BRIGHT = 0xF000F0;
    private static final int LIGHT = 0xF4EAFF;
    private static final int DEEP = 0xB48CFF;
    private static final int GLOW = 0x7A3CF0;
    /** How far the text hangs from the player, in blocks. */
    private static final float RADIUS = 14f;
    /** Block size of one font pixel at normal size. */
    private static final float PIXEL = 0.075f;
    private static final long LETTER = 35;
    private static final long LETTER_IN = 520;
    private static final long FADE_OUT = 450;
    /** Pieces of one line stack downwards by this many degrees. */
    private static final float ROW_STEP = 4.2f;
    /** At most this many pieces of a line are on screen; older ones leave first. */
    private static final int MAX_ROWS = 2;
    /** A piece with nothing after it (an instrumental part) goes away after this. */
    private static final long MAX_LIFE = 9000;

    private static final class Floating {
        final List<Component> letters = new ArrayList<>();
        final long born;
        long dying = Long.MAX_VALUE;
        /** Centre of the arc and its basis, fixed in the world around the player. */
        final Vector3f forward;
        final Vector3f right;
        final Vector3f up;
        final float size;

        Floating(String text, long born, float yaw, float pitch, float tilt, float size) {
            text.codePoints().forEach(cp -> letters.add(Fonts.letter(new String(Character.toChars(cp)))));
            this.born = born;
            this.size = size;
            Vec3 f = Vec3.directionFromRotation(pitch, yaw);
            forward = new Vector3f((float) f.x, (float) f.y, (float) f.z).normalize();
            Vector3f r = new Vector3f(forward).cross(0f, 1f, 0f);
            if (r.lengthSquared() < 1e-4f) {
                r.set(1f, 0f, 0f);
            }
            r.normalize();
            Vector3f u = new Vector3f(r).cross(forward).normalize();
            // Tilt the arc around the forward axis, so pieces run at an angle.
            float c = Mth.cos(tilt);
            float sn = Mth.sin(tilt);
            right = new Vector3f(r).mul(c).add(new Vector3f(u).mul(sn));
            up = new Vector3f(u).mul(c).sub(new Vector3f(r).mul(sn));
        }
    }

    private static final List<Floating> shown = new ArrayList<>();
    private static String track = "";
    private static int lineIndex = -1;
    private static int pieceIndex = -1;
    private static int pieceCount;
    /** Where the current line was started: all its pieces hang below this point. */
    private static float lineYaw;
    private static float linePitch;
    private static final java.util.Random random = new java.util.Random();
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
        if (mc.level == null || mc.player == null || !Config.get().lyrics) {
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
        // The camera looks along its -Z, hence the half turn and the minus on the pitch.
        Quaternionf camera = new Quaternionf().rotationYXZ(
                Mth.PI - viewer.getYRot() * Mth.DEG_TO_RAD, -viewer.getXRot() * Mth.DEG_TO_RAD, 0f);
        PoseStack pose = new PoseStack();
        if (applyView) {
            rotate(pose, new Quaternionf(camera).conjugate());
        }
        for (Floating line : shown) {
            draw(line, now, pose, sink, mc.font);
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

    /**
     * A new piece. The first piece of a line goes right where the player looks;
     * the next pieces of the same line stack under it like subtitles, so they
     * never cover each other. A new line clears the old one quickly.
     */
    private static void spawn(String text, long now) {
        int k = pieceCount++;
        if (k == 0) {
            fadeAll(now);
            lineYaw = viewYaw;
            linePitch = viewPitch;
        }
        // Keep at most MAX_ROWS pieces of this line; the oldest leaves first.
        int alive = 0;
        for (int i = shown.size() - 1; i >= 0; i--) {
            Floating f = shown.get(i);
            if (f.dying != Long.MAX_VALUE) continue;
            if (++alive >= MAX_ROWS) f.dying = now;
        }
        float pitch = Mth.clamp(linePitch + (k % MAX_ROWS) * ROW_STEP, -80f, 80f);
        float tilt = (random.nextFloat() - 0.5f) * 0.04f;
        shown.add(new Floating(text, now, lineYaw, pitch, tilt, 1f));
        while (shown.size() > 6) {
            shown.remove(0);
        }
    }

    private static void draw(Floating line, long now, PoseStack pose, Sink sink, Font font) {
        long age = now - line.born;
        float out = line.dying == Long.MAX_VALUE ? 1f : 1f - Mth.clamp((now - line.dying) / (float) FADE_OUT, 0f, 1f);
        if (out < 0.01f) {
            return;
        }
        float outEase = easeInOut(out);
        float pixel = PIXEL * line.size;

        int width = 0;
        for (Component c : line.letters) {
            width += font.width(c);
        }
        // Letters sit on a great circle around the player: x pixels along the
        // text become an angle of x * pixel / RADIUS.
        float x = -width / 2f;
        int n = line.letters.size();
        for (int i = 0; i < n; i++) {
            Component c = line.letters.get(i);
            int w = font.width(c);
            float t = Mth.clamp((age - i * LETTER) / (float) LETTER_IN, 0f, 1f);
            float in = easeOut(t);
            int a = (int) (255 * in * outEase);
            if (a > 4) {
                // Fly in from further out with a little sweep; drift out the same way when leaving.
                float radius = RADIUS + (1f - in) * 1.5f + (1f - outEase) * 1.5f;
                float angle = (x + w / 2f) * pixel / RADIUS;
                float lift = (1f - in) * -0.25f + (1f - outEase) * 0.4f;

                Vector3f radial = new Vector3f(line.forward).mul(Mth.cos(angle)).add(new Vector3f(line.right).mul(Mth.sin(angle)));
                Vector3f tangent = new Vector3f(line.right).mul(Mth.cos(angle)).sub(new Vector3f(line.forward).mul(Mth.sin(angle)));
                Vector3f normal = new Vector3f(tangent).cross(line.up);
                Vector3f pos = new Vector3f(radial).mul(radius).add(new Vector3f(line.up).mul(lift));

                // Columns: text x along the arc, text y up, facing the player.
                Quaternionf facing = new Quaternionf().setFromNormalized(new Matrix3f(tangent, line.up, normal));
                float wave = 0.5f + 0.5f * Mth.sin(i * 0.45f - age / 450f);
                int rgb = lerpColor(LIGHT, DEEP, wave);
                float pop = 0.85f + 0.15f * easeOutBack(t);

                pose.pushPose();
                pose.translate(pos.x, pos.y, pos.z);
                rotate(pose, facing);
                pose.scale(pixel * pop, -pixel * pop, pixel * pop);
                int glow = ((int) (a * 0.16f) << 24) | GLOW;
                if (a * 0.16f > 4) {
                    for (float[] o : GLOW_OFFSETS) {
                        sink.letter(pose, c, -w / 2f + o[0], -4f + o[1], glow, false);
                    }
                }
                sink.letter(pose, c, -w / 2f, -4f, (a << 24) | rgb, false);
                pose.popPose();
            }
            x += w;
        }
    }

    /** A thin soft halo; wider offsets made the letters look smeared. */
    private static final float[][] GLOW_OFFSETS = {
        {-0.45f, -0.45f}, {0.45f, -0.45f}, {-0.45f, 0.45f}, {0.45f, 0.45f},
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
