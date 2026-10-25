package net.bi4visual.mod;

import net.minecraft.client.CameraType;
import net.minecraft.client.Minecraft;

/**
 * FreeLook: while the bind is held the camera goes to third person and the
 * mouse turns only the camera; the player keeps looking where it was.
 */
public final class FreeLook {
    private static boolean active;
    private static CameraType before;
    public static float yaw, pitch;

    private FreeLook() {}

    public static boolean active() {
        return active;
    }

    static void frame(Minecraft mc, Config.Data d) {
        boolean held = d.freeLook && mc.screen == null && Keys.down(d.binds.getOrDefault("freeLook", 0));
        if (held && !active && mc.player != null) {
            active = true;
            yaw = mc.player.getYRot();
            pitch = mc.player.getXRot();
            before = mc.options.getCameraType();
            if (before.isFirstPerson()) mc.options.setCameraType(CameraType.THIRD_PERSON_BACK);
        } else if (!held && active) {
            active = false;
            if (before != null) mc.options.setCameraType(before);
        }
    }

    /** Mouse movement while active, in the same units as Entity#turn. */
    public static void turn(double dx, double dy) {
        yaw += (float) dx * 0.15f;
        pitch = Math.max(-90f, Math.min(90f, pitch + (float) dy * 0.15f));
    }
}
