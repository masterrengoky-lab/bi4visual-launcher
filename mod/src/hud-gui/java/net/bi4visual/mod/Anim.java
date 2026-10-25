package net.bi4visual.mod;

import java.lang.reflect.Method;
import net.minecraft.client.gui.GuiGraphics;

/**
 * Small GUI animations for BetterMinecraft. The GUI transform is a PoseStack up
 * to 1.21.5 and a 2D matrix stack from 1.21.6, so it is driven by method name.
 */
public final class Anim {
    private static final long OPEN_MS = 180;
    private static long openedAt;
    private static Method push, pop, translate, scale;
    private static boolean pose3d, broken;

    private Anim() {}

    /** A container screen was just opened. */
    public static void opened() {
        openedAt = System.currentTimeMillis();
    }

    /** 0..1 of the open animation, eased out. */
    public static float openProgress() {
        float t = Math.min(1f, (System.currentTimeMillis() - openedAt) / (float) OPEN_MS);
        return 1f - (1f - t) * (1f - t) * (1f - t);
    }

    /** Starts drawing scaled around (cx, cy); returns false when nothing was pushed. */
    public static boolean pushScale(GuiGraphics g, float k, float cx, float cy) {
        if (broken) return false;
        try {
            Object stack = g.pose();
            if (push == null) {
                Class<?> c = stack.getClass();
                try {
                    push = c.getMethod("pushPose");
                    pop = c.getMethod("popPose");
                    translate = c.getMethod("translate", float.class, float.class, float.class);
                    scale = c.getMethod("scale", float.class, float.class, float.class);
                    pose3d = true;
                } catch (NoSuchMethodException e) {
                    push = c.getMethod("pushMatrix");
                    pop = c.getMethod("popMatrix");
                    translate = c.getMethod("translate", float.class, float.class);
                    scale = c.getMethod("scale", float.class, float.class);
                }
            }
            push.invoke(stack);
            if (pose3d) {
                translate.invoke(stack, cx, cy, 0f);
                scale.invoke(stack, k, k, 1f);
                translate.invoke(stack, -cx, -cy, 0f);
            } else {
                translate.invoke(stack, cx, cy);
                scale.invoke(stack, k, k);
                translate.invoke(stack, -cx, -cy);
            }
            return true;
        } catch (Exception e) {
            broken = true;
            return false;
        }
    }

    public static void pop(GuiGraphics g) {
        try {
            pop.invoke(g.pose());
        } catch (Exception e) {
            broken = true;
        }
    }

    // ---------- third person camera ----------

    private static long lastCamera;
    private static long thirdAt;

    /**
     * 0..1 of the camera sliding out after switching to third person. It is asked
     * only while the camera is out, so a pause between calls means a new switch.
     */
    public static float cameraProgress(boolean third) {
        long now = System.currentTimeMillis();
        if (!third) return 1f;
        if (now - lastCamera > 150) thirdAt = now;
        lastCamera = now;
        float t = Math.min(1f, (now - thirdAt) / 260f);
        return 1f - (1f - t) * (1f - t);
    }
}
