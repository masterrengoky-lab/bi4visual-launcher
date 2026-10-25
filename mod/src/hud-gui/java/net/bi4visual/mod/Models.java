package net.bi4visual.mod;

import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;
import net.minecraft.util.Mth;
import net.minecraft.world.entity.player.Player;
import org.joml.Quaternionf;

/**
 * Custom models: our own accessories built from coloured cubes around the
 * player (demon horns and wings, rabbit ears, cat ears and tail, angel wings).
 * Drawn with the world text pipeline, so only the own player in third person.
 * Units are model pixels (1/16 block, scaled like the player model).
 */
final class Models {
    private static final Component SQUARE = Fonts.fx('');

    private Models() {}

    static boolean render(Lyrics3D.Sink sink, PoseStack pose, Minecraft mc, Player player, double x, double y, double z,
                          float partial, long now) {
        String model = Config.get().model3d;
        if (model == null || model.equals("off")) return false;
        float k = Modules.modelScale() * 0.9375f / 16f;
        float bodyYaw = Mth.rotLerp(partial, player.yBodyRotO, player.yBodyRot);
        float headYaw = Mth.rotLerp(partial, player.yHeadRotO, player.yHeadRot) - bodyYaw;
        float pitch = player.getViewXRot(partial);
        boolean crouch = player.isCrouching();
        float t = (now % 100_000L) / 1000f;

        pose.pushPose();
        pose.translate((float) x, (float) y, (float) z);
        Lyrics3D.turn(pose, new Quaternionf().rotationY(-bodyYaw * Mth.DEG_TO_RAD));
        pose.scale(k, k, k);
        float neck = crouch ? 20.5f : 24f;
        float back = crouch ? -3.5f : -2f;
        switch (model) {
            case "demon" -> demon(sink, pose, neck, back, headYaw, pitch, t);
            case "rabbit" -> rabbit(sink, pose, neck, back, headYaw, pitch, t);
            case "cat" -> cat(sink, pose, neck, back, headYaw, pitch, t);
            case "angel" -> angel(sink, pose, neck, back, t);
            default -> {
            }
        }
        pose.popPose();
        return true;
    }

    /** Moves the pose onto the head: neck pivot, then the head's own turn and tilt. */
    private static void head(PoseStack pose, float neck, float headYaw, float pitch) {
        pose.translate(0, neck, 0);
        Lyrics3D.turn(pose, new Quaternionf().rotationY(-headYaw * Mth.DEG_TO_RAD).rotateX(pitch * Mth.DEG_TO_RAD));
    }

    // ---------- the models ----------

    private static void demon(Lyrics3D.Sink sink, PoseStack pose, float neck, float back, float headYaw, float pitch, float t) {
        int horn = 0xFF3A0A10, tip = 0xFF120406, wing = 0xFF5A0F18, bone = 0xFF2A060A;
        pose.pushPose();
        head(pose, neck, headYaw, pitch);
        for (int side = -1; side <= 1; side += 2) {
            cube(sink, pose, side * 3.5f, 8.5f, 1f, 2, 2.5f, 2, horn);
            cube(sink, pose, side * 4.5f, 10.5f, 0.5f, 1.6f, 2.2f, 1.6f, horn);
            cube(sink, pose, side * 5.2f, 12.3f, -0.3f, 1.1f, 1.8f, 1.1f, tip);
        }
        pose.popPose();
        float flap = Mth.sin(t * 2.2f) * 12f;
        for (int side = -1; side <= 1; side += 2) {
            pose.pushPose();
            pose.translate(side * 1.5f, neck - 3, back - 0.5f);
            Lyrics3D.turn(pose, new Quaternionf().rotationY(side * (25f + flap) * Mth.DEG_TO_RAD).rotateZ(-side * 15f * Mth.DEG_TO_RAD));
            cube(sink, pose, side * 6f, 0, 0, 12, 1.2f, 0.6f, bone);
            cube(sink, pose, side * 5f, -4f, 0, 10, 7, 0.3f, wing);
            cube(sink, pose, side * 9f, -8.5f, 0, 5, 3, 0.3f, wing);
            pose.popPose();
        }
        tail(sink, pose, back, t, 0xFF2A060A, 0xFF5A0F18, true);
    }

    private static void rabbit(Lyrics3D.Sink sink, PoseStack pose, float neck, float back, float headYaw, float pitch, float t) {
        int fur = 0xFFF2EEEA, inner = 0xFFF2A6B4;
        pose.pushPose();
        head(pose, neck, headYaw, pitch);
        float wiggle = Mth.sin(t * 3f) * 6f;
        for (int side = -1; side <= 1; side += 2) {
            pose.pushPose();
            pose.translate(side * 2f, 8f, 0);
            Lyrics3D.turn(pose, new Quaternionf().rotationZ(-side * (10f + (side > 0 ? wiggle : 0)) * Mth.DEG_TO_RAD));
            cube(sink, pose, 0, 4f, 0, 2.5f, 8, 1, fur);
            cube(sink, pose, 0, 4f, -0.55f, 1.4f, 6.5f, 0.1f, inner);
            pose.popPose();
        }
        pose.popPose();
        cube(sink, pose, 0, 11f, back - 1.2f, 3, 3, 2.4f, fur);
    }

    private static void cat(Lyrics3D.Sink sink, PoseStack pose, float neck, float back, float headYaw, float pitch, float t) {
        int fur = 0xFF2B2B33, inner = 0xFFE89AAE;
        pose.pushPose();
        head(pose, neck, headYaw, pitch);
        for (int side = -1; side <= 1; side += 2) {
            cube(sink, pose, side * 2.8f, 8.6f, 0, 2.6f, 1.4f, 1, fur);
            cube(sink, pose, side * 2.8f, 9.8f, 0, 1.7f, 1.2f, 1, fur);
            cube(sink, pose, side * 2.8f, 10.8f, 0, 0.8f, 1, 1, fur);
            cube(sink, pose, side * 2.8f, 9.1f, -0.55f, 1.2f, 1.2f, 0.1f, inner);
        }
        pose.popPose();
        tail(sink, pose, back, t, fur, fur, false);
    }

    private static void angel(Lyrics3D.Sink sink, PoseStack pose, float neck, float back, float t) {
        int feather = 0xFFF7F4EE, shade = 0xFFDCD8E6;
        float flap = Mth.sin(t * 1.6f) * 8f;
        for (int side = -1; side <= 1; side += 2) {
            pose.pushPose();
            pose.translate(side * 1.5f, neck - 3, back - 0.5f);
            Lyrics3D.turn(pose, new Quaternionf().rotationY(side * (30f + flap) * Mth.DEG_TO_RAD).rotateZ(side * 10f * Mth.DEG_TO_RAD));
            for (int i = 0; i < 5; i++) {
                float len = 13f - i * 2f;
                cube(sink, pose, side * (len / 2f + 0.5f), -i * 2.2f, -i * 0.15f, len, 2.4f, 0.4f, i % 2 == 0 ? feather : shade);
            }
            pose.popPose();
        }
    }

    /** A tail of small cubes curving down and out from the lower back. */
    private static void tail(Lyrics3D.Sink sink, PoseStack pose, float back, float t, int colour, int tip, boolean spade) {
        float sway = Mth.sin(t * 2f) * 0.6f;
        float px = 0, py = 11.5f, pz = back - 0.5f;
        float angle = 0.4f;
        for (int i = 0; i < 7; i++) {
            float s = 1.4f - i * 0.1f;
            cube(sink, pose, px, py, pz, s, s, s, colour);
            angle += spade ? 0.25f : -0.3f;
            px += sway * (i + 1) * 0.25f;
            py -= Mth.cos(angle) * 1.2f;
            pz -= Mth.sin(Math.abs(angle)) * 1.3f + 0.4f;
        }
        if (spade) cube(sink, pose, px, py, pz, 2.6f, 2.6f, 0.4f, tip);
    }

    // ---------- drawing ----------

    /** A box centred at (cx, cy, cz) in model pixels, flat shaded per face. */
    private static void cube(Lyrics3D.Sink sink, PoseStack pose, float cx, float cy, float cz, float sx, float sy, float sz, int argb) {
        face(sink, pose, cx, cy + sy / 2, cz, sx, sz, new Quaternionf().rotationX(-Mth.HALF_PI), shade(argb, 1f));
        face(sink, pose, cx, cy - sy / 2, cz, sx, sz, new Quaternionf().rotationX(Mth.HALF_PI), shade(argb, 0.55f));
        face(sink, pose, cx, cy, cz + sz / 2, sx, sy, new Quaternionf(), shade(argb, 0.85f));
        face(sink, pose, cx, cy, cz - sz / 2, sx, sy, new Quaternionf().rotationY(Mth.PI), shade(argb, 0.85f));
        face(sink, pose, cx + sx / 2, cy, cz, sz, sy, new Quaternionf().rotationY(Mth.HALF_PI), shade(argb, 0.7f));
        face(sink, pose, cx - sx / 2, cy, cz, sz, sy, new Quaternionf().rotationY(-Mth.HALF_PI), shade(argb, 0.7f));
    }

    /** One square of the solid glyph, w by h, centred at the point and turned by q. */
    private static void face(Lyrics3D.Sink sink, PoseStack pose, float x, float y, float z, float w, float h, Quaternionf q, int argb) {
        pose.pushPose();
        pose.translate(x, y, z);
        Lyrics3D.turn(pose, q);
        pose.scale(w / 64f, -h / 64f, 1f);
        // The bitmap glyph's top sits at y + 7 - ascent (32), so y = -7 centres the 64 px square.
        sink.letter(pose, SQUARE, -32f, -7f, argb, false);
        // Text may be back-face culled, so the square is drawn from the other side too.
        Lyrics3D.turn(pose, new Quaternionf().rotationY(Mth.PI));
        sink.letter(pose, SQUARE, -32f, -7f, argb, false);
        pose.popPose();
    }

    private static int shade(int argb, float f) {
        int r = (int) (((argb >> 16) & 0xFF) * f), g = (int) (((argb >> 8) & 0xFF) * f), b = (int) ((argb & 0xFF) * f);
        return (argb & 0xFF000000) | (r << 16) | (g << 8) | b;
    }
}
