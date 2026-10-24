package net.bi4visual.mod;

import com.mojang.blaze3d.vertex.PoseStack;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;
import net.minecraft.util.Mth;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.phys.Vec3;
import org.joml.Quaternionf;

/**
 * Things drawn in the world with the lyrics' text pipeline: waypoint labels,
 * rings where the player jumped and a fading trail behind them.
 */
public final class World3D {
    private static final long RING_LIFE = 900;
    private static final long TRAIL_LIFE = 1100;

    private record Ring(double x, double y, double z, long born) {}

    private record Dot(double x, double y, double z, long born) {}

    private static final List<Ring> rings = new ArrayList<>();
    private static final ArrayDeque<Dot> trail = new ArrayDeque<>();
    private static long lastDot;

    private World3D() {}

    static void jumped(double x, double y, double z) {
        if (!Config.get().jumpCircles) return;
        synchronized (rings) {
            rings.add(new Ring(x, y + 0.02, z, System.currentTimeMillis()));
            while (rings.size() > 8) rings.remove(0);
        }
    }

    static void track(double x, double y, double z) {
        long now = System.currentTimeMillis();
        if (!Config.get().trails || now - lastDot < 30) return;
        Dot last = trail.peekLast();
        if (last != null && Math.abs(last.x - x) + Math.abs(last.y - y) + Math.abs(last.z - z) < 0.05) return;
        lastDot = now;
        synchronized (trail) {
            trail.add(new Dot(x, y + 0.9, z, now));
            while (trail.size() > 60) trail.removeFirst();
        }
    }

    /** The point the world is drawn from: the player's eyes, between ticks. */
    private static Vec3 eye(Minecraft mc, Player player) {
        float partial = mc.getDeltaTracker().getGameTimeDeltaPartialTick(true);
        return player.getEyePosition(partial);
    }

    static boolean render(Lyrics3D.Sink sink, PoseStack pose, Quaternionf camera) {
        Minecraft mc = Minecraft.getInstance();
        Player player = mc.player;
        if (player == null || mc.level == null) return false;
        Vec3 eye = eye(mc, player);
        long now = System.currentTimeMillis();
        int accent = Config.accent() & 0xFFFFFF;
        boolean drawn = false;

        synchronized (rings) {
            for (Iterator<Ring> it = rings.iterator(); it.hasNext(); ) {
                Ring r = it.next();
                float t = (now - r.born) / (float) RING_LIFE;
                if (t >= 1f) {
                    it.remove();
                    continue;
                }
                float ease = 1f - (1f - t) * (1f - t) * (1f - t);
                float radius = 0.25f + ease * 1.1f;
                int a = (int) (230 * (1f - t));
                flat(sink, pose, r.x - eye.x, r.y - eye.y, r.z - eye.z, radius, (a << 24) | accent);
                drawn = true;
            }
        }

        if (mc.options.getCameraType().isFirstPerson()) {
            // The trail is behind the player, only third person sees it.
        } else {
            synchronized (trail) {
                trail.removeIf(dot -> now - dot.born > TRAIL_LIFE);
                for (Dot dot : trail) {
                    float t = (now - dot.born) / (float) TRAIL_LIFE;
                    int a = (int) (200 * (1f - t));
                    if (a < 6) continue;
                    billboard(sink, pose, camera, dot.x - eye.x, dot.y - eye.y, dot.z - eye.z, Fonts.fx('\ue031'), 0.35f * (1f - t * 0.6f) / 64f, (a << 24) | accent, -32f, 0f);
                    drawn = true;
                }
            }
        }

        String dim = mc.level.dimension().toString();
        for (Config.Waypoint w : Config.get().waypoints) {
            if (!dim.equals(w.dim)) continue;
            double dx = w.x + 0.5 - eye.x;
            double dy = w.y + 1.2 - eye.y;
            double dz = w.z + 0.5 - eye.z;
            double dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            // Far points are pulled closer along the same line, so they stay readable.
            double shown = Math.min(dist, 40);
            double k = dist < 1e-3 ? 0 : shown / dist;
            float scale = (float) (0.02 + shown * 0.0022);
            String label = w.name + "  " + Math.round(dist) + "м";
            Component text = Fonts.hud(label);
            int width = mc.font.width(text);
            billboard(sink, pose, camera, dx * k, dy * k, dz * k, Fonts.hud("◆"), scale, 0xFF000000 | accent, -width / 2f - 8f, -4f);
            billboard(sink, pose, camera, dx * k, dy * k, dz * k, text, scale, 0xFFF1F3F8, -width / 2f, -4f);
            drawn = true;
        }
        return drawn;
    }

    /** A ring glyph lying flat on the ground, centred at the point. */
    private static void flat(Lyrics3D.Sink sink, PoseStack pose, double x, double y, double z, float radius, int argb) {
        float size = radius * 2f / 64f;
        pose.pushPose();
        pose.translate((float) x, (float) y, (float) z);
        Lyrics3D.turn(pose, new Quaternionf().rotationX(-Mth.HALF_PI));
        pose.scale(size, size, size);
        sink.letter(pose, Fonts.fx('\ue030'), -32f, 0f, argb, false);
        pose.popPose();
    }

    /** Text facing the camera at the point, drawn from (x0, y0) in font pixels. */
    private static void billboard(Lyrics3D.Sink sink, PoseStack pose, Quaternionf camera, double x, double y, double z,
                                  Component text, float scale, int argb, float x0, float y0) {
        pose.pushPose();
        pose.translate((float) x, (float) y, (float) z);
        Lyrics3D.turn(pose, camera);
        pose.scale(scale, -scale, scale);
        sink.letter(pose, text, x0, y0, argb, false);
        pose.popPose();
    }
}
