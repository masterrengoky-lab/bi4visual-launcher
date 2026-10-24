package net.bi4visual.mod;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.math.Axis;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import net.minecraft.ChatFormatting;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.network.chat.Component;
import net.minecraft.util.Mth;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.phys.Vec3;
import org.joml.Quaternionf;

/**
 * Lines of the playing song floating in the sky around the player. Each line
 * types itself in letter by letter, drifts up and fades out when the next one starts.
 */
public final class Lyrics3D {
    /** Packed light for "lit by sky and block light 15", same as LightTexture.FULL_BRIGHT. */
    public static final int FULL_BRIGHT = 0xF000F0;
    private static final int TOP = 0xE6CCFF;
    private static final int BOTTOM = 0x9A66FF;
    private static final float DISTANCE = 10f;
    private static final long FADE_IN = 350;
    private static final long FADE_OUT = 700;
    private static final long LETTER = 35;
    /** A line with no next one (an instrumental part) goes away after this. */
    private static final long MAX_LIFE = 9000;

    private static final class Floating {
        final List<Component> letters = new ArrayList<>();
        final float yaw;
        final float pitch;
        final float roll;
        final long born;
        long dying = Long.MAX_VALUE;

        Floating(String text, float yaw, float pitch, float roll, long born) {
            text.codePoints().forEach(cp -> letters.add(Component.literal(new String(Character.toChars(cp))).withStyle(ChatFormatting.BOLD)));
            this.yaw = yaw;
            this.pitch = pitch;
            this.roll = roll;
            this.born = born;
        }
    }

    private static final List<Floating> shown = new ArrayList<>();
    private static final Random random = new Random();
    private static String track = "";
    private static int lineIndex = -1;
    private static int side = 1;

    private Lyrics3D() {}

    /** Draws one letter; the game version decides how (see the backend's LevelRendererMixin). */
    public interface Sink {
        void letter(PoseStack pose, Component letter, float x, float y, int argb);
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
        // Same rotation the camera builds from the view angles (Camera#setRotation);
        // taken from the player because the camera's getters differ between versions.
        Quaternionf camera = new Quaternionf().rotationYXZ(
                -mc.player.getYRot() * Mth.DEG_TO_RAD, mc.player.getXRot() * Mth.DEG_TO_RAD, 0f);
        update(NowPlaying.get(), now, mc.player);
        if (shown.isEmpty()) {
            return false;
        }

        PoseStack pose = new PoseStack();
        if (applyView) {
            rotate(pose, new Quaternionf(camera).conjugate());
        }
        for (Floating line : shown) {
            draw(line, now, pose, sink, mc.font, camera);
        }
        return true;
    }

    private static void update(NowPlaying.Data np, long now, Entity viewer) {
        String key = np == null ? "" : np.title + "\u0000" + np.artist;
        if (!key.equals(track)) {
            track = key;
            lineIndex = -1;
            fadeAll(now);
        }
        if (np != null && np.lines != null && !np.lines.isEmpty()) {
            long pos = np.position(now);
            int index = -1;
            for (int i = 0; i < np.lines.size() && np.lines.get(i).t <= pos; i++) {
                index = i;
            }
            if (index != lineIndex) {
                lineIndex = index;
                fadeAll(now);
                String text = index >= 0 ? np.lines.get(index).text : "";
                if (text != null && !text.isBlank()) {
                    spawn(text.trim(), now, viewer);
                }
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

    private static void spawn(String text, long now, Entity viewer) {
        // Lines take turns left and right of where the player looks, a bit above the crosshair.
        side = -side;
        float yaw = viewer.getYRot() + side * (8f + random.nextFloat() * 22f);
        float pitch = Mth.clamp(viewer.getXRot() - 6f + (random.nextFloat() - 0.5f) * 14f, -75f, 45f);
        float roll = (random.nextFloat() - 0.5f) * 10f;
        shown.add(new Floating(text, yaw, pitch, roll, now));
        while (shown.size() > 4) {
            shown.remove(0);
        }
    }

    private static void draw(Floating line, long now, PoseStack pose, Sink sink, Font font, Quaternionf camera) {
        long age = now - line.born;
        float in = Mth.clamp(age / (float) FADE_IN, 0f, 1f);
        float out = line.dying == Long.MAX_VALUE ? 1f : 1f - Mth.clamp((now - line.dying) / (float) FADE_OUT, 0f, 1f);
        float alpha = easeOut(in) * out;
        if (alpha < 0.02f) {
            return;
        }

        Vec3 dir = Vec3.directionFromRotation(line.pitch, line.yaw);
        float rise = age / 1000f * 0.12f + (1f - out) * 0.8f;
        float sway = Mth.sin(age / 900f) * 0.08f;

        pose.pushPose();
        pose.translate(dir.x * DISTANCE + sway, dir.y * DISTANCE + rise, dir.z * DISTANCE);
        rotate(pose, camera);
        rotate(pose, Axis.ZP.rotationDegrees(line.roll));
        float scale = 0.05f * (0.8f + 0.2f * easeOut(in)) * (1f + (1f - out) * 0.15f);
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
            float letterIn = Mth.clamp((age - i * LETTER) / 220f, 0f, 1f);
            int a = (int) (255 * alpha * letterIn);
            if (a > 4) {
                float y = (1f - easeOut(letterIn)) * 5f;
                int rgb = lerpColor(TOP, BOTTOM, n <= 1 ? 0f : i / (float) (n - 1));
                sink.letter(pose, c, x, y, (a << 24) | rgb);
            }
            x += w;
        }
        pose.popPose();
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
