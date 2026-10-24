package net.bi4visual.mod;

import java.lang.reflect.Method;

/**
 * The game samples font pictures pixel by pixel, which makes big floating
 * letters look torn. Our own fonts' pictures are switched to smooth filtering.
 */
public final class Smooth {
    private Smooth() {}

    /** Calls the texture's setFilter(blur, mipmap), found by shape since its name differs between versions. */
    public static void linear(Object texture) {
        for (Class<?> c = texture.getClass(); c != null && c != Object.class; c = c.getSuperclass()) {
            for (Method m : c.getDeclaredMethods()) {
                Class<?>[] p = m.getParameterTypes();
                if (m.getReturnType() == void.class && p.length == 2 && p[0] == boolean.class && p[1] == boolean.class) {
                    try {
                        m.setAccessible(true);
                        m.invoke(texture, true, false);
                    } catch (Exception ignored) {
                        // Keep the game's filtering.
                    }
                    return;
                }
            }
        }
    }
}
