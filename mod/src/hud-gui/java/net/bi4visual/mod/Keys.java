package net.bi4visual.mod;

import java.util.HashMap;
import java.util.Map;
import org.lwjgl.glfw.GLFW;

/**
 * Keys read straight from GLFW on the render thread (1.21.x): the game's own
 * key APIs changed in 1.21.9, this works the same in every version.
 */
public final class Keys {
    private static final Map<Integer, Boolean> was = new HashMap<>();

    private Keys() {}

    private static long window() {
        return GLFW.glfwGetCurrentContext();
    }

    /** True while the key is held. */
    public static boolean down(int key) {
        long window = window();
        return window != 0 && key > 0 && GLFW.glfwGetKey(window, key) == GLFW.GLFW_PRESS;
    }

    /** True once per press of the key. */
    public static boolean pressed(int key) {
        boolean down = down(key);
        Boolean before = was.put(key, down);
        return down && (before == null || !before);
    }

    /** True once per press of Right Shift. */
    public static boolean rightShiftPressed() {
        return pressed(GLFW.GLFW_KEY_RIGHT_SHIFT);
    }

    /** The first key held right now, for assigning binds; 0 when none. */
    public static int anyDown() {
        for (int key = GLFW.GLFW_KEY_SPACE; key <= GLFW.GLFW_KEY_LAST; key++) {
            if (key != GLFW.GLFW_KEY_RIGHT_SHIFT && down(key)) return key;
        }
        return 0;
    }

    /** A short name for a key code: "C", "F5", "none". */
    public static String name(Integer key) {
        if (key == null || key <= 0) return "none";
        String n = GLFW.glfwGetKeyName(key, 0);
        if (n != null && !n.isBlank()) return n.toUpperCase();
        return switch (key) {
            case GLFW.GLFW_KEY_SPACE -> "SPACE";
            case GLFW.GLFW_KEY_LEFT_SHIFT -> "LSHIFT";
            case GLFW.GLFW_KEY_LEFT_CONTROL -> "LCTRL";
            case GLFW.GLFW_KEY_RIGHT_CONTROL -> "RCTRL";
            case GLFW.GLFW_KEY_LEFT_ALT -> "LALT";
            case GLFW.GLFW_KEY_RIGHT_ALT -> "RALT";
            case GLFW.GLFW_KEY_TAB -> "TAB";
            case GLFW.GLFW_KEY_CAPS_LOCK -> "CAPS";
            case GLFW.GLFW_KEY_UP -> "UP";
            case GLFW.GLFW_KEY_DOWN -> "DOWN";
            case GLFW.GLFW_KEY_LEFT -> "LEFT";
            case GLFW.GLFW_KEY_RIGHT -> "RIGHT";
            case GLFW.GLFW_KEY_INSERT -> "INS";
            case GLFW.GLFW_KEY_DELETE -> "DEL";
            case GLFW.GLFW_KEY_HOME -> "HOME";
            case GLFW.GLFW_KEY_END -> "END";
            case GLFW.GLFW_KEY_PAGE_UP -> "PGUP";
            case GLFW.GLFW_KEY_PAGE_DOWN -> "PGDN";
            default -> key >= GLFW.GLFW_KEY_F1 && key <= GLFW.GLFW_KEY_F25 ? "F" + (key - GLFW.GLFW_KEY_F1 + 1) : "#" + key;
        };
    }
}
