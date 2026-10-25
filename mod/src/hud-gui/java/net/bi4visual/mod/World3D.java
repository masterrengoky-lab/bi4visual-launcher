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
            // The trail and the cosmetics are around the player, only third person sees them.
        } else {
            drawn |= cosmetics(sink, pose, camera, mc, player, eye, now, accent);
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

    /** Halo, aura and orbit around the own player, sized with the custom model. */
    private static boolean cosmetics(Lyrics3D.Sink sink, PoseStack pose, Quaternionf camera, Minecraft mc, Player player,
                                     Vec3 eye, long now, int accent) {
        Config.Data d = Config.get();
        float partial = mc.getDeltaTracker().getGameTimeDeltaPartialTick(true);
        Vec3 feet = player.getPosition(partial);
        float k = Modules.modelScale();
        double x = feet.x - eye.x, y = feet.y - eye.y, z = feet.z - eye.z;
        boolean model = Models.render(sink, pose, mc, player, x, y, z, partial, now);
        if (!d.halo && !d.aura && !d.orbit && !d.chinaHat) return model;
        if (d.chinaHat) {
            // A cone of rings, wide at the brim and closing at the tip.
            double top = (player.isCrouching() ? 1.55 : 1.9) * k + 0.04;
            for (int i = 0; i < 14; i++) {
                float f = i / 13f;
                float radius = (0.62f - f * 0.58f) * k;
                int a = (int) (200 - f * 90);
                flat(sink, pose, x, y + top + f * 0.32 * k, z, radius, (a << 24) | accent);
            }
        }
        float t = (now % 100_000L) / 1000f;
        if (d.halo) {
            float bob = Mth.sin(t * 2.2f) * 0.03f;
            double top = (player.isCrouching() ? 1.6 : 1.95) * k + 0.12 + bob;
            flat(sink, pose, x, y + top, z, 0.28f * k, 0xE0000000 | accent);
            flat(sink, pose, x, y + top, z, 0.34f * k, 0x50000000 | accent);
        }
        if (d.aura) {
            float pulse = (t * 0.8f) % 1f;
            flat(sink, pose, x, y + 0.03, z, (0.45f + pulse * 0.45f) * k, ((int) (170 * (1f - pulse)) << 24) | accent);
            flat(sink, pose, x, y + 0.03, z, 0.5f * k, 0x60000000 | accent);
        }
        if (d.orbit) {
            for (int i = 0; i < 3; i++) {
                float a = t * 2.4f + i * Mth.TWO_PI / 3f;
                double ox = Math.cos(a) * 0.7 * k, oz = Math.sin(a) * 0.7 * k;
                double oy = (1.0 + Mth.sin(t * 1.7f + i * 2f) * 0.35) * k;
                billboard(sink, pose, camera, x + ox, y + oy, z + oz, Fonts.fx('\ue031'), 0.22f * k / 64f, 0xF0000000 | accent, -32f, 0f);
                billboard(sink, pose, camera, x + ox, y + oy, z + oz, Fonts.fx('\ue031'), 0.42f * k / 64f, 0x40000000 | accent, -32f, 0f);
            }
        }
        return true;
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
