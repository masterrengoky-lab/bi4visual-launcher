package net.bi4visual.mod;

import org.lwjgl.glfw.GLFW;

/**
 * Right Shift, read straight from GLFW on the render thread (1.21.x): the game's own
 * key APIs changed in 1.21.9, this works the same in every version.
 */
public final class Keys {
    private static boolean wasDown;

    private Keys() {}

    /** True once per press of Right Shift. */
    public static boolean rightShiftPressed() {
        long window = GLFW.glfwGetCurrentContext();
        boolean down = window != 0 && GLFW.glfwGetKey(window, GLFW.GLFW_KEY_RIGHT_SHIFT) == GLFW.GLFW_PRESS;
        boolean pressed = down && !wasDown;
        wasDown = down;
        return pressed;
    }
}
