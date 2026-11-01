package net.bi4visual.mod;

import com.mojang.blaze3d.vertex.PoseStack;
import java.util.ArrayList;
import java.util.ArrayDeque;
import java.util.Iterator;
import java.util.List;
import java.util.Random;
import net.minecraft.client.Minecraft;
import net.minecraft.util.Mth;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.phys.Vec3;
import org.joml.Quaternionf;
import org.joml.Vector3f;

/**
 * NovaVis world effects, drawn with the same text pipeline as the lyrics:
 * hit and kill effects, trail styles, jump stars, block overlay styles,
 * companion orbs, lines in the sky, shooting stars and fireflies.
 * All of it is only on this client and only decoration: nothing here shows
 * anything the player could not already see.
 */
public final class Effects {
    static final char RING = '', DOT = '', SQUARE = '', BOLT = '', SHARD = '',
            SKULL = '', GRAVE = '', BUBBLE = '', STAR = '', SPLAT = '',
            STREAK = '', CRYSTAL = '', GLOW = '';

    /** How a particle is laid out: facing the camera, lying on the ground, or turned by its own rotation. */
    private enum Mode { FACE, GROUND, TURNED }

    /** One short-lived picture moving through the world. */
    private static final class Part {
        char glyph;
        Mode mode = Mode.FACE;
        Quaternionf turn;
        double x, y, z, vx, vy, vz;
        float gravity, drag = 0.985f;
        long born, life;
        float size, grow, roll, spin;
        int rgb;
        int alpha = 230;
        boolean flicker;
    }

    private static final List<Part> parts = new ArrayList<>();
    private static final Random random = new Random();
    private static long lastFrame;

    private Effects() {}

    private static Part add(char glyph, double x, double y, double z, long life, float size, int rgb) {
        Part p = new Part();
        p.glyph = glyph;
        p.x = x;
        p.y = y;
        p.z = z;
        p.born = System.currentTimeMillis();
        p.life = life;
        p.size = size;
        p.rgb = rgb & 0xFFFFFF;
        synchronized (parts) {
            parts.add(p);
            while (parts.size() > 600) parts.remove(0);
        }
        return p;
    }

    private static double rnd(double spread) {
        return (random.nextDouble() - 0.5) * 2 * spread;
    }

    // ---------- hits and kills ----------

    /** The player hit something: the chosen HitEffect around it. */
    public static void hit(Entity target) {
        String style = Config.get().hitStyle;
        if (style == null || style.equals("off")) return;
        double x = target.getX(), y = target.getY() + target.getBbHeight() * 0.55, z = target.getZ();
        float w = Math.max(0.5f, target.getBbWidth());
        int accent = Config.accent();
        switch (style) {
            case "shards" -> {
                for (int i = 0; i < 12; i++) {
                    Part p = add(SHARD, x + rnd(w * 0.3), y + rnd(0.4), z + rnd(w * 0.3), 900 + random.nextInt(400),
                            0.22f + random.nextFloat() * 0.18f, mix(0xDDEBFF, accent, 0.25f));
                    double a = random.nextDouble() * Math.PI * 2;
                    double s = 0.05 + random.nextDouble() * 0.06;
                    p.vx = Math.cos(a) * s;
                    p.vz = Math.sin(a) * s;
                    p.vy = 0.04 + random.nextDouble() * 0.07;
                    p.gravity = 0.006f;
                    p.roll = random.nextFloat() * Mth.TWO_PI;
                    p.spin = rnd(0.25f) > 0 ? 0.18f : -0.18f;
                }
            }
            case "lightning" -> {
                for (int i = 0; i < 6; i++) {
                    double a = i * Math.PI / 3 + rnd(0.3);
                    Part p = add(BOLT, x + Math.cos(a) * w * 0.55, y + rnd(0.35), z + Math.sin(a) * w * 0.55, 420,
                            0.7f + random.nextFloat() * 0.4f, mix(0xB8C8FF, accent, 0.4f));
                    p.roll = (float) rnd(0.6);
                    p.flicker = true;
                }
                Part g = add(GLOW, x, y, z, 380, w * 2.6f, mix(0x9FB4FF, accent, 0.4f));
                g.alpha = 150;
                g.grow = 0.6f;
            }
            case "bubbles" -> {
                for (int i = 0; i < 10; i++) {
                    Part p = add(BUBBLE, x + rnd(w * 0.6), y + rnd(0.5), z + rnd(w * 0.6), 1100 + random.nextInt(500),
                            0.12f + random.nextFloat() * 0.2f, mix(0xE8F0FF, accent, 0.3f));
                    p.vx = rnd(0.015);
                    p.vz = rnd(0.015);
                    p.vy = 0.015 + random.nextDouble() * 0.02;
                    p.grow = 0.5f;
                }
            }
            case "crystal" -> {
                for (int i = 0; i < 8; i++) {
                    double a = i * Math.PI / 4;
                    Part p = add(CRYSTAL, x, y - 0.1, z, 800, 0.35f, i % 2 == 0 ? accent : 0xE6ECFF);
                    p.vx = Math.cos(a) * 0.07;
                    p.vz = Math.sin(a) * 0.07;
                    p.vy = 0.02;
                    p.drag = 0.93f;
                    p.spin = 0.12f;
                }
                Part r = add(RING, x, target.getY() + 0.05, z, 700, w * 1.2f, accent);
                r.mode = Mode.GROUND;
                r.grow = 2.2f;
            }
            default -> {
            }
        }
    }

    /** Something the player hit died: the chosen KillEffect where it fell. */
    static void kill(double x, double y, double z, float w, float h) {
        String style = Config.get().killStyle;
        if (style == null || style.equals("off")) return;
        int accent = Config.accent();
        switch (style) {
            case "grave" -> {
                Part p = add(GRAVE, x, y + 0.45, z, 3200, 0.95f, mix(0xD9CCFF, accent, 0.5f));
                p.vy = 0.004;
                p.drag = 0.97f;
                Part g = add(GLOW, x, y + 0.5, z, 3200, 2.2f, accent);
                g.alpha = 90;
                souls(x, y, z, accent);
            }
            case "skull" -> {
                Part p = add(SKULL, x, y + h * 0.7, z, 2600, 0.8f, mix(0xE6DCFF, accent, 0.45f));
                p.vy = 0.012;
                p.drag = 0.99f;
                Part g = add(GLOW, x, y + h * 0.7, z, 2600, 2f, accent);
                g.alpha = 110;
                g.vy = 0.012;
                g.drag = 0.99f;
                souls(x, y, z, accent);
            }
            case "blood" -> {
                Part p = add(SPLAT, x, y + 0.03, z, 4000, w * 1.6f, 0xD0122A);
                p.mode = Mode.GROUND;
                p.grow = 0.5f;
                p.roll = random.nextFloat() * Mth.TWO_PI;
                for (int i = 0; i < 14; i++) {
                    Part d = add(DOT, x + rnd(0.2), y + h * 0.6, z + rnd(0.2), 900, 0.18f, 0xE01834);
                    d.vx = rnd(0.08);
                    d.vz = rnd(0.08);
                    d.vy = 0.05 + random.nextDouble() * 0.06;
                    d.gravity = 0.008f;
                }
            }
            case "sphere" -> {
                for (int i = 0; i < 6; i++) {
                    Part r = add(RING, x, y + h * 0.5, z, 1200, 0.6f, i % 2 == 0 ? accent : 0xFFFFFF);
                    r.mode = Mode.TURNED;
                    r.turn = new Quaternionf().rotationY(i * Mth.PI / 6).rotateX(i % 3 * Mth.PI / 3 + Mth.HALF_PI / 2);
                    r.grow = 3.2f;
                }
                Part g = add(GLOW, x, y + h * 0.5, z, 900, 3f, accent);
                g.alpha = 140;
            }
            default -> {
            }
        }
    }

    private static void souls(double x, double y, double z, int accent) {
        for (int i = 0; i < 8; i++) {
            Part s = add(DOT, x + rnd(0.5), y + random.nextDouble(), z + rnd(0.5), 1600 + random.nextInt(800), 0.25f, accent);
            s.vy = 0.02 + random.nextDouble() * 0.02;
            s.vx = rnd(0.01);
            s.vz = rnd(0.01);
            s.drag = 1f;
        }
    }

    /** JumpCircle in the "stars" style: little stars fly out of the ring. */
    static void jumpStars(double x, double y, double z) {
        int accent = Config.accent();
        for (int i = 0; i < 10; i++) {
            double a = i * Math.PI / 5;
            Part p = add(STAR, x, y + 0.1, z, 700, 0.22f, i % 2 == 0 ? accent : 0xFFFFFF);
            p.vx = Math.cos(a) * 0.06;
            p.vz = Math.sin(a) * 0.06;
            p.vy = 0.03;
            p.drag = 0.92f;
            p.spin = 0.2f;
        }
    }

    // ---------- trails ----------

    private static final int[] RAINBOW = {0xFF2D55, 0xFF9500, 0xFFE620, 0x34D058, 0x2F9BFF, 0x9B5CFF};

    /**
     * Draws the trail in the chosen style; "glow" is World3D's own soft dots.
     * Points are given oldest first, relative to the eye, with their age 0..1.
     */
    static boolean trail(Lyrics3D.Sink sink, PoseStack pose, Quaternionf camera, String style, List<double[]> points, int accent) {
        if (points.size() < 2) return false;
        boolean drawn = false;
        long now = System.currentTimeMillis();
        for (int i = 1; i < points.size(); i++) {
            double[] a = points.get(i - 1), b = points.get(i);
            double dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
            double len = Math.sqrt(dx * dx + dy * dy + dz * dz);
            int steps = Math.max(1, Math.min(8, (int) Math.ceil(len / 0.09)));
            for (int s = 0; s < steps; s++) {
                double f = s / (double) steps;
                double x = a[0] + dx * f, y = a[1] + dy * f, z = a[2] + dz * f;
                float age = (float) (a[3] + (b[3] - a[3]) * f);
                float fade = 1f - age;
                if (fade <= 0.03f) continue;
                switch (style) {
                    case "rainbow" -> {
                        for (int k = 0; k < RAINBOW.length; k++) {
                            double sy = y + 0.27 - k * 0.1;
                            sprite(sink, pose, camera, x, sy, z, SQUARE, 0.11f, 0f, argb((int) (235 * fade), RAINBOW[k]));
                        }
                    }
                    case "ribbon" -> {
                        for (int k = 0; k < 4; k++) {
                            float shade = 1f - k * 0.18f;
                            sprite(sink, pose, camera, x, y + 0.15 - k * 0.1, z, SQUARE, 0.11f, 0f,
                                    argb((int) (220 * fade), mix(accent, 0xFFFFFF, 0.25f * (1 - shade) + 0.1f)));
                        }
                    }
                    case "vapor" -> {
                        if (s % 3 != 0) continue;
                        float wob = Mth.sin(now / 240f + i * 0.9f) * 0.08f;
                        float size = (0.32f + wob + (i % 4) * 0.06f) * (0.6f + fade * 0.6f);
                        sprite(sink, pose, camera, x, y - 0.2 + wob, z, BUBBLE, size, 0f, argb((int) (170 * fade), mix(0xDCE6FF, accent, 0.2f)));
                        sprite(sink, pose, camera, x, y - 0.2 + wob, z, GLOW, size * 1.8f, 0f, argb((int) (60 * fade), mix(0xDCE6FF, accent, 0.4f)));
                    }
                    default -> {
                    }
                }
                drawn = true;
            }
        }
        return drawn;
    }

    // ---------- block overlay ----------

    /** BlockOverlay styles other than the plain fill; the box is centred at (cx, cy, cz) relative to the eye. */
    static void overlay(Lyrics3D.Sink sink, PoseStack pose, String style, double cx, double cy, double cz,
                        float sx, float sy, float sz, int accent) {
        long now = System.currentTimeMillis();
        switch (style) {
            case "outline" -> edges(sink, pose, cx, cy, cz, sx, sy, sz, 0.02f, 0xF0000000 | accent);
            case "pulse" -> {
                float p = 0.5f + 0.5f * Mth.sin(now / 260f);
                pose.pushPose();
                pose.translate((float) cx, (float) cy, (float) cz);
                Models.cube(sink, pose, 0, 0, 0, sx, sy, sz, argb((int) (30 + 70 * p), accent));
                pose.popPose();
                edges(sink, pose, cx, cy, cz, sx, sy, sz, 0.018f, argb((int) (150 + 100 * p), accent));
            }
            case "rainbow" -> {
                int rgb = java.awt.Color.HSBtoRGB((now % 4000) / 4000f, 0.65f, 1f);
                edges(sink, pose, cx, cy, cz, sx, sy, sz, 0.022f, 0xF0000000 | (rgb & 0xFFFFFF));
            }
            case "glass" -> {
                pose.pushPose();
                pose.translate((float) cx, (float) cy, (float) cz);
                Models.cube(sink, pose, 0, 0, 0, sx, sy, sz, 0x30FFFFFF);
                pose.popPose();
                edges(sink, pose, cx, cy, cz, sx, sy, sz, 0.012f, 0xD0FFFFFF);
            }
            default -> {
                pose.pushPose();
                pose.translate((float) cx, (float) cy, (float) cz);
                Models.cube(sink, pose, 0, 0, 0, sx, sy, sz, 0x48000000 | accent);
                pose.popPose();
            }
        }
    }

    /** The twelve edges of a box as thin bars. */
    static void edges(Lyrics3D.Sink sink, PoseStack pose, double cx, double cy, double cz,
                      float sx, float sy, float sz, float t, int argb) {
        float hx = sx / 2, hy = sy / 2, hz = sz / 2;
        pose.pushPose();
        pose.translate((float) cx, (float) cy, (float) cz);
        for (int a = -1; a <= 1; a += 2) {
            for (int b = -1; b <= 1; b += 2) {
                Models.cube(sink, pose, 0, a * hy, b * hz, sx + t, t, t, argb);
                Models.cube(sink, pose, a * hx, 0, b * hz, t, sy + t, t, argb);
                Models.cube(sink, pose, a * hx, b * hy, 0, t, t, sz + t, argb);
            }
        }
        pose.popPose();
    }

    // ---------- around the player and in the sky ----------

    private static final Vec3[] orbs = new Vec3[3];

    private static final class Line {
        final List<float[]> points = new ArrayList<>();
        float phase, hue;
    }

    private static final List<Line> lines = new ArrayList<>();
    private static double linesX = Double.NaN, linesZ;

    private static final class Fly {
        double x, y, z, vx, vy, vz;
        float phase;
    }

    private static final List<Fly> flies = new ArrayList<>();
    private static final ArrayDeque<Part> stars = new ArrayDeque<>();
    private static long nextStar;

    /** Everything above, once a frame. */
    static boolean render(Lyrics3D.Sink sink, PoseStack pose, Quaternionf camera, Minecraft mc, Player player, Vec3 eye, int accent) {
        long now = System.currentTimeMillis();
        float dt = lastFrame == 0 ? 0.016f : Math.min(0.1f, (now - lastFrame) / 1000f);
        lastFrame = now;
        boolean paused = mc.isPaused();
        Config.Data d = Config.get();
        boolean drawn = false;

        drawn |= particles(sink, pose, camera, eye, now, paused ? 0 : dt);
        if (!"off".equals(d.companion)) drawn |= companion(sink, pose, camera, mc, player, eye, now, dt, d.companion, accent);
        if (!"off".equals(d.worldLines)) drawn |= lines(sink, pose, player, eye, now, d.worldLines, accent);
        if (d.shootingStars) drawn |= shootingStars(sink, pose, camera, eye, now, paused ? 0 : dt);
        if (!"off".equals(d.fireflies)) drawn |= fireflies(sink, pose, camera, player, eye, now, paused ? 0 : dt, d.fireflies, accent);
        return drawn;
    }

    private static boolean particles(Lyrics3D.Sink sink, PoseStack pose, Quaternionf camera, Vec3 eye, long now, float dt) {
        float steps = dt * 20f; // velocities are per game tick
        boolean drawn = false;
        synchronized (parts) {
            for (Iterator<Part> it = parts.iterator(); it.hasNext(); ) {
                Part p = it.next();
                float t = (now - p.born) / (float) p.life;
                if (t >= 1f) {
                    it.remove();
                    continue;
                }
                if (steps > 0) {
                    p.vy -= p.gravity * steps;
                    float drag = (float) Math.pow(p.drag, steps);
                    p.vx *= drag;
                    p.vy *= drag;
                    p.vz *= drag;
                    p.x += p.vx * steps;
                    p.y += p.vy * steps;
                    p.z += p.vz * steps;
                    p.roll += p.spin * steps;
                }
                float fade = t < 0.1f ? t / 0.1f : 1f - (t - 0.1f) / 0.9f;
                int a = (int) (p.alpha * fade);
                if (p.flicker && random.nextFloat() < 0.35f) a /= 3;
                if (a < 4) continue;
                float size = p.size * (1f + p.grow * t);
                double x = p.x - eye.x, y = p.y - eye.y, z = p.z - eye.z;
                int col = argb(a, p.rgb);
                switch (p.mode) {
                    case FACE -> sprite(sink, pose, camera, x, y, z, p.glyph, size, p.roll, col);
                    case GROUND -> disc(sink, pose, x, y, z, new Quaternionf().rotationX(-Mth.HALF_PI).rotateZ(p.roll), p.glyph, size, col);
                    case TURNED -> disc(sink, pose, x, y, z, p.turn, p.glyph, size, col);
                }
                drawn = true;
            }
        }
        return drawn;
    }

    private static boolean companion(Lyrics3D.Sink sink, PoseStack pose, Quaternionf camera, Minecraft mc, Player player,
                                     Vec3 eye, long now, float dt, String style, int accent) {
        float partial = mc.getDeltaTracker().getGameTimeDeltaPartialTick(true);
        Vec3 feet = player.getPosition(partial);
        float t = (now % 1_000_000L) / 1000f;
        float yaw = player.getViewYRot(partial) * Mth.DEG_TO_RAD;
        int colour = style.equals("electric") ? mix(0x7FA6FF, accent, 0.3f) : accent;
        for (int i = 0; i < orbs.length; i++) {
            // Behind and above the shoulders, so first person sees them only when looking around.
            float a = yaw + (i - 1) * 0.8f + Mth.sin(t * 0.7f + i) * 0.35f;
            // The player looks along (-sin yaw, cos yaw), so (sin a, -cos a) is behind them.
            double tx = feet.x + Math.sin(a) * 1.25, tz = feet.z - Math.cos(a) * 1.25;
            double ty = feet.y + 1.9 + Mth.sin(t * 1.6f + i * 2.1f) * 0.25 + i * 0.12;
            Vec3 target = new Vec3(tx, ty, tz);
            Vec3 cur = orbs[i];
            if (cur == null || cur.distanceToSqr(target) > 100) cur = target;
            orbs[i] = cur.lerp(target, Math.min(1f, dt * 4f));
            double x = orbs[i].x - eye.x, y = orbs[i].y - eye.y, z = orbs[i].z - eye.z;
            float pulse = 1f + Mth.sin(t * 5f + i) * 0.08f;
            sprite(sink, pose, camera, x, y, z, GLOW, 1.1f * pulse, 0f, argb(150, colour));
            sprite(sink, pose, camera, x, y, z, GLOW, 0.45f, 0f, argb(240, mix(colour, 0xFFFFFF, 0.6f)));
            sprite(sink, pose, camera, x, y, z, RING, 0.42f * pulse, 0f, argb(200, colour));
            if (style.equals("electric")) {
                long bucket = now / 70 + i * 13L;
                Random r = new Random(bucket);
                for (int k = 0; k < 3; k++) {
                    sprite(sink, pose, camera, x, y, z, BOLT, 0.5f + r.nextFloat() * 0.3f, r.nextFloat() * Mth.TWO_PI, argb(220, mix(colour, 0xFFFFFF, 0.4f)));
                }
            }
        }
        return true;
    }

    private static boolean lines(Lyrics3D.Sink sink, PoseStack pose, Player player, Vec3 eye, long now, String style, int accent) {
        if (Double.isNaN(linesX) || Math.abs(player.getX() - linesX) > 40 || Math.abs(player.getZ() - linesZ) > 40) {
            makeLines(player.getX(), player.getY(), player.getZ(), style.equals("lightning"));
        }
        float t = now / 1000f;
        boolean bolt = style.equals("lightning");
        for (Line line : lines) {
            float cycle = ((t * 0.18f + line.phase) % 1f);
            float shown = Math.min(1f, cycle * 2.2f);
            float fade = cycle < 0.7f ? 1f : 1f - (cycle - 0.7f) / 0.3f;
            if (bolt) fade *= (Math.floorMod((long) (t * 14 + line.phase * 50), 5) == 0) ? 0.45f : 1f;
            int rgb = switch (style) {
                case "neon" -> java.awt.Color.HSBtoRGB(line.hue, 0.7f, 1f) & 0xFFFFFF;
                case "lightning" -> mix(0xB4C6FF, accent, 0.25f);
                default -> 0xEEF0FF;
            };
            int segments = line.points.size() - 1;
            float upto = shown * segments;
            for (int s = 0; s < segments && s < upto; s++) {
                float[] a = line.points.get(s), b = line.points.get(s + 1);
                float part = Math.min(1f, upto - s);
                float bx = a[0] + (b[0] - a[0]) * part, by = a[1] + (b[1] - a[1]) * part, bz = a[2] + (b[2] - a[2]) * part;
                float th = bolt ? 0.07f : 0.045f;
                double cx = (a[0] + bx) / 2 - eye.x, cy = (a[1] + by) / 2 - eye.y, cz = (a[2] + bz) / 2 - eye.z;
                pose.pushPose();
                pose.translate((float) cx, (float) cy, (float) cz);
                Models.cube(sink, pose, 0, 0, 0, Math.abs(bx - a[0]) + th, Math.abs(by - a[1]) + th, Math.abs(bz - a[2]) + th,
                        argb((int) (220 * fade), rgb));
                if (bolt) {
                    Models.cube(sink, pose, 0, 0, 0, Math.abs(bx - a[0]) + th * 4, Math.abs(by - a[1]) + th * 4, Math.abs(bz - a[2]) + th * 4,
                            argb((int) (45 * fade), rgb));
                }
                pose.popPose();
                pose.pushPose();
                pose.translate(a[0] - (float) eye.x, a[1] - (float) eye.y, a[2] - (float) eye.z);
                Models.cube(sink, pose, 0, 0, 0, th * 2.4f, th * 2.4f, th * 2.4f, argb((int) (255 * fade), 0xFFFFFF));
                pose.popPose();
            }
        }
        return !lines.isEmpty();
    }

    private static void makeLines(double px, double py, double pz, boolean bolt) {
        lines.clear();
        linesX = px;
        linesZ = pz;
        Random r = new Random((long) Math.floor(px / 40) * 31 + (long) Math.floor(pz / 40) * 17 + (bolt ? 7 : 0));
        int count = bolt ? 14 : 20;
        for (int i = 0; i < count; i++) {
            Line line = new Line();
            line.phase = r.nextFloat();
            line.hue = r.nextFloat();
            float x = (float) (px + (r.nextFloat() - 0.5f) * 56), z = (float) (pz + (r.nextFloat() - 0.5f) * 56);
            float y = (float) (py + 10 + r.nextFloat() * 22);
            line.points.add(new float[] {x, y, z});
            int n = bolt ? 10 + r.nextInt(6) : 4 + r.nextInt(5);
            for (int k = 0; k < n; k++) {
                float len = bolt ? 0.6f + r.nextFloat() * 1.6f : 2f + r.nextFloat() * 6f;
                switch (r.nextInt(bolt ? 3 : 4)) {
                    case 0 -> x += r.nextBoolean() ? len : -len;
                    case 1 -> z += r.nextBoolean() ? len : -len;
                    default -> y -= len;
                }
                line.points.add(new float[] {x, y, z});
            }
            lines.add(line);
        }
    }

    private static boolean shootingStars(Lyrics3D.Sink sink, PoseStack pose, Quaternionf camera, Vec3 eye, long now, float dt) {
        if (now > nextStar && dt > 0) {
            nextStar = now + 350 + random.nextInt(900);
            double a = random.nextDouble() * Math.PI * 2;
            double elev = 0.35 + random.nextDouble() * 0.6;
            double dist = 70;
            Part p = new Part();
            p.x = Math.cos(a) * Math.cos(elev) * dist;
            p.y = Math.sin(elev) * dist;
            p.z = Math.sin(a) * Math.cos(elev) * dist;
            double ang = a + Math.PI / 2 + rnd(0.6);
            double speed = 1.2 + random.nextDouble() * 1.4;
            p.vx = Math.cos(ang) * speed;
            p.vz = Math.sin(ang) * speed;
            p.vy = -0.35 * speed;
            p.born = now;
            p.life = 900 + random.nextInt(700);
            p.size = 5f + random.nextFloat() * 3f;
            stars.add(p);
            while (stars.size() > 12) stars.removeFirst();
        }
        boolean drawn = false;
        Quaternionf inverse = new Quaternionf(camera).conjugate();
        for (Iterator<Part> it = stars.iterator(); it.hasNext(); ) {
            Part p = it.next();
            float t = (now - p.born) / (float) p.life;
            if (t >= 1f) {
                it.remove();
                continue;
            }
            float steps = dt * 20f;
            p.x += p.vx * steps;
            p.y += p.vy * steps;
            p.z += p.vz * steps;
            // Stars are kept around the eye, like the sky: only the direction matters.
            Vector3f dir = inverse.transform(new Vector3f((float) p.vx, (float) p.vy, (float) p.vz));
            float roll = (float) Math.atan2(dir.y, dir.x);
            float fade = t < 0.15f ? t / 0.15f : 1f - (t - 0.15f) / 0.85f;
            sprite(sink, pose, camera, p.x, p.y, p.z, STREAK, p.size, roll, argb((int) (235 * fade), 0xEAF0FF));
            drawn = true;
        }
        return drawn;
    }

    private static boolean fireflies(Lyrics3D.Sink sink, PoseStack pose, Quaternionf camera, Player player, Vec3 eye,
                                     long now, float dt, String amount, int accent) {
        int want = amount.equals("many") ? 70 : 30;
        while (flies.size() > want) flies.remove(flies.size() - 1);
        while (flies.size() < want) flies.add(newFly(player, true));
        float t = now / 1000f;
        for (int i = 0; i < flies.size(); i++) {
            Fly f = flies.get(i);
            if (Math.abs(f.x - player.getX()) > 14 || Math.abs(f.z - player.getZ()) > 14 || Math.abs(f.y - player.getY()) > 8) {
                flies.set(i, f = newFly(player, false));
            }
            float steps = dt * 20f;
            f.vx += rnd(0.002) * steps;
            f.vy += rnd(0.0015) * steps;
            f.vz += rnd(0.002) * steps;
            f.vx = Mth.clamp(f.vx, -0.03, 0.03);
            f.vy = Mth.clamp(f.vy, -0.015, 0.015);
            f.vz = Mth.clamp(f.vz, -0.03, 0.03);
            f.x += f.vx * steps;
            f.y += f.vy * steps;
            f.z += f.vz * steps;
            float blink = 0.35f + 0.65f * Math.max(0f, Mth.sin(t * 1.8f + f.phase));
            double x = f.x - eye.x, y = f.y - eye.y, z = f.z - eye.z;
            int rgb = mix(0xFFE27A, accent, 0.35f);
            sprite(sink, pose, camera, x, y, z, GLOW, 0.5f, 0f, argb((int) (110 * blink), rgb));
            sprite(sink, pose, camera, x, y, z, DOT, 0.12f, 0f, argb((int) (250 * blink), mix(rgb, 0xFFFFFF, 0.5f)));
        }
        return true;
    }

    private static Fly newFly(Player player, boolean anywhere) {
        Fly f = new Fly();
        double a = random.nextDouble() * Math.PI * 2;
        double r = anywhere ? 1.5 + random.nextDouble() * 11 : 9 + random.nextDouble() * 4;
        f.x = player.getX() + Math.cos(a) * r;
        f.z = player.getZ() + Math.sin(a) * r;
        f.y = player.getY() + 0.3 + random.nextDouble() * 3.5;
        f.phase = random.nextFloat() * 10;
        return f;
    }

    // ---------- drawing ----------

    /** A glyph facing the camera, centred at the point, size in blocks, turned by roll on screen. */
    static void sprite(Lyrics3D.Sink sink, PoseStack pose, Quaternionf camera, double x, double y, double z,
                       char glyph, float size, float roll, int argb) {
        pose.pushPose();
        pose.translate((float) x, (float) y, (float) z);
        Lyrics3D.turn(pose, camera);
        if (roll != 0f) Lyrics3D.turn(pose, new Quaternionf().rotationZ(roll));
        float s = size / 64f;
        pose.scale(s, -s, s);
        sink.letter(pose, Fonts.fx(glyph), -32f, -7f, argb, false);
        pose.popPose();
    }

    /** A glyph on a plane turned by q, seen from both sides. */
    static void disc(Lyrics3D.Sink sink, PoseStack pose, double x, double y, double z, Quaternionf q, char glyph, float size, int argb) {
        pose.pushPose();
        pose.translate((float) x, (float) y, (float) z);
        Lyrics3D.turn(pose, q);
        float s = size / 64f;
        pose.scale(s, -s, s);
        sink.letter(pose, Fonts.fx(glyph), -32f, -7f, argb, false);
        Lyrics3D.turn(pose, new Quaternionf().rotationY(Mth.PI));
        sink.letter(pose, Fonts.fx(glyph), -32f, -7f, argb, false);
        pose.popPose();
    }

    static int argb(int a, int rgb) {
        return (Mth.clamp(a, 0, 255) << 24) | (rgb & 0xFFFFFF);
    }

    static int mix(int a, int b, float k) {
        int r = (int) (((a >> 16) & 0xFF) * (1 - k) + ((b >> 16) & 0xFF) * k);
        int g = (int) (((a >> 8) & 0xFF) * (1 - k) + ((b >> 8) & 0xFF) * k);
        int bl = (int) ((a & 0xFF) * (1 - k) + (b & 0xFF) * k);
        return (r << 16) | (g << 8) | bl;
    }
}
