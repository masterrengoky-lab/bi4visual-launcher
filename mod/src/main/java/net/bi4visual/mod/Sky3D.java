package net.bi4visual.mod;

import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.network.chat.Component;
import net.minecraft.util.Mth;
import org.joml.Matrix3f;
import org.joml.Quaternionf;
import org.joml.Vector3f;

/**
 * A purple galaxy band and aurora curtains drawn behind the world. The pictures
 * are glyphs of the bi4visual:sky font (one 128 px tile each), which lets every
 * game version draw them the same way it draws text.
 */
public final class Sky3D {
    private static final float RADIUS = 100f;
    private static final int TILE = 128;
    private static final int GALAXY_TILES = 12;
    private static final int AURORA_TILES = 8;

    private Sky3D() {}

    /** Draws into the sky pass; the pose is camera-relative, with the view rotation applied elsewhere. */
    public static boolean render(Lyrics3D.Sink sink, PoseStack pose, float visibility) {
        String mode = Config.get().sky;
        boolean galaxy = "galaxy".equals(mode) || "both".equals(mode);
        boolean aurora = "aurora".equals(mode) || "both".equals(mode);
        if (!galaxy && !aurora || visibility < 0.02f) {
            return false;
        }
        float time = (System.currentTimeMillis() % 3_600_000L) / 1000f;
        if (galaxy) {
            galaxy(sink, pose, time, visibility);
        }
        if (aurora) {
            aurora(sink, pose, time, visibility);
        }
        return true;
    }

    /** The band runs along a great circle tilted 55 degrees from the horizon and turns very slowly. */
    private static void galaxy(Lyrics3D.Sink sink, PoseStack pose, float time, float visibility) {
        float tilt = 55f * Mth.DEG_TO_RAD;
        float spin = time * 0.004f;
        Vector3f a = new Vector3f(Mth.cos(spin), 0f, Mth.sin(spin));
        Vector3f side = new Vector3f(-Mth.sin(spin), 0f, Mth.cos(spin));
        Vector3f b = new Vector3f(side).mul(Mth.cos(tilt)).add(0f, Mth.sin(tilt), 0f);
        Vector3f up = new Vector3f(b).cross(a).normalize();
        float step = Mth.TWO_PI / GALAXY_TILES;
        float size = 2f * RADIUS * Mth.sin(step / 2f) / TILE * 1.004f;
        for (int i = 0; i < GALAXY_TILES; i++) {
            float angle = (i + 0.5f) * step;
            Vector3f radial = new Vector3f(a).mul(Mth.cos(angle)).add(new Vector3f(b).mul(Mth.sin(angle)));
            Vector3f tangent = new Vector3f(b).mul(Mth.cos(angle)).sub(new Vector3f(a).mul(Mth.sin(angle)));
            for (int row = 0; row < 2; row++) {
                char tile = (char) ((row == 0 ? 0xE000 : 0xE010) + i);
                tile(sink, pose, radial.mul(RADIUS, new Vector3f()), tangent, up, size, Fonts.sky(tile), row == 0 ? -63f : 63f, ((int) (255 * visibility) << 24) | 0xFFFFFF);
            }
        }
    }

    /** Curtains in a ring above the horizon, swaying and breathing. */
    private static void aurora(Lyrics3D.Sink sink, PoseStack pose, float time, float visibility) {
        Vector3f up = new Vector3f(0f, 1f, 0f);
        float step = Mth.TWO_PI / AURORA_TILES;
        float radius = RADIUS * 0.9f;
        float size = 2f * radius * Mth.sin(step / 2f) / TILE * 1.004f;
        for (int i = 0; i < AURORA_TILES; i++) {
            float angle = (i + 0.5f) * step + Mth.sin(time * 0.15f + i) * 0.03f;
            Vector3f radial = new Vector3f(Mth.cos(angle), 0f, Mth.sin(angle));
            Vector3f tangent = new Vector3f(-Mth.sin(angle), 0f, Mth.cos(angle));
            Vector3f pos = new Vector3f(radial).mul(radius).add(0f, radius * 0.18f, 0f);
            float breathe = 0.65f + 0.35f * Mth.sin(time * 0.6f + i * 1.7f);
            int a = (int) (255 * breathe * visibility);
            tile(sink, pose, pos, tangent, up, size, Fonts.sky((char) (0xE020 + i)), -64f, (a << 24) | 0xFFFFFF);
        }
    }

    /** One tile centred at pos, its x along tangent and y along up, facing the player. */
    private static void tile(Lyrics3D.Sink sink, PoseStack pose, Vector3f pos, Vector3f tangent, Vector3f up,
                             float size, Component glyph, float centreY, int argb) {
        Vector3f normal = new Vector3f(tangent).cross(up);
        Quaternionf facing = new Quaternionf().setFromNormalized(new Matrix3f(tangent, up, normal));
        pose.pushPose();
        pose.translate(pos.x, pos.y, pos.z);
        pose.last().pose().rotate(facing);
        pose.scale(size, -size, size);
        // A bitmap glyph drawn at y spans y - 121 .. y + 7 (ascent 121 of 128).
        sink.letter(pose, glyph, -TILE / 2f, centreY + 57f, argb, false);
        pose.popPose();
    }
}
