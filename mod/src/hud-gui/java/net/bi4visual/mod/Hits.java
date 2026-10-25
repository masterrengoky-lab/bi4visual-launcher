package net.bi4visual.mod;

import com.mojang.blaze3d.vertex.PoseStack;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import net.minecraft.client.Minecraft;
import net.minecraft.util.Mth;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.phys.Vec3;
import org.joml.Quaternionf;

/**
 * Effects of the own hits: a ring on the ground under the target (HitCircle),
 * a wave around it (HitWave), the damage dealt floating up (DamageParticles)
 * and a burst when it dies (DeathEffect). Only entities you hit are followed.
 */
public final class Hits {
    private static final long LIFE = 700, NUMBER_LIFE = 900, DEATH_LIFE = 1000, FOLLOW_MS = 3000;

    private enum Kind { CIRCLE, WAVE, NUMBER, DEATH }

    private record Effect(Kind kind, double x, double y, double z, float size, String text, long born) {}

    private record Target(LivingEntity entity, float health, long hitAt) {}

    private static final List<Effect> effects = new ArrayList<>();
    private static final Map<Integer, Target> followed = new HashMap<>();

    private Hits() {}

    /** The player attacked something: show the hit and start following its health. */
    public static void attacked(Entity target) {
        Config.Data d = Config.get();
        long now = System.currentTimeMillis();
        float w = target.getBbWidth();
        synchronized (effects) {
            if (d.hitCircle) effects.add(new Effect(Kind.CIRCLE, target.getX(), target.getY() + 0.03, target.getZ(), w, null, now));
            if (d.hitWave) effects.add(new Effect(Kind.WAVE, target.getX(), target.getY() + target.getBbHeight() / 2, target.getZ(), w, null, now));
            while (effects.size() > 40) effects.remove(0);
        }
        if (target instanceof LivingEntity living && (d.damageNumbers || d.deathEffect)) {
            Target old = followed.get(living.getId());
            followed.put(living.getId(), new Target(living, old != null ? old.health : living.getHealth(), now));
        }
    }

    /** Once a frame: health drops of followed entities become numbers, deaths become bursts. */
    static void tick() {
        if (followed.isEmpty()) return;
        Config.Data d = Config.get();
        long now = System.currentTimeMillis();
        for (Iterator<Map.Entry<Integer, Target>> it = followed.entrySet().iterator(); it.hasNext(); ) {
            Map.Entry<Integer, Target> e = it.next();
            Target t = e.getValue();
            LivingEntity en = t.entity;
            float hp = en.getHealth();
            synchronized (effects) {
                if (hp < t.health - 0.01f && d.damageNumbers) {
                    String text = String.format(Locale.ROOT, "%.1f", t.health - hp).replace(".0", "");
                    double jitter = (en.getRandom().nextDouble() - 0.5) * 0.5;
                    effects.add(new Effect(Kind.NUMBER, en.getX() + jitter, en.getY() + en.getBbHeight() + 0.2, en.getZ() + jitter, 0, text, now));
                }
                if ((en.isDeadOrDying() || en.isRemoved()) && d.deathEffect && t.health > 0) {
                    effects.add(new Effect(Kind.DEATH, en.getX(), en.getY(), en.getZ(), en.getBbWidth(), null, now));
                    it.remove();
                    continue;
                }
            }
            if (now - t.hitAt > FOLLOW_MS || en.isRemoved()) it.remove();
            else e.setValue(new Target(en, hp, t.hitAt));
        }
    }

    static boolean render(Lyrics3D.Sink sink, PoseStack pose, Quaternionf camera, Vec3 eye, long now, int accent) {
        boolean drawn = false;
        Minecraft mc = Minecraft.getInstance();
        synchronized (effects) {
            for (Iterator<Effect> it = effects.iterator(); it.hasNext(); ) {
                Effect e = it.next();
                long life = e.kind == Kind.NUMBER ? NUMBER_LIFE : e.kind == Kind.DEATH ? DEATH_LIFE : LIFE;
                float t = (now - e.born) / (float) life;
                if (t >= 1f) {
                    it.remove();
                    continue;
                }
                float ease = 1f - (1f - t) * (1f - t);
                int a = (int) (230 * (1f - t));
                double x = e.x - eye.x, y = e.y - eye.y, z = e.z - eye.z;
                switch (e.kind) {
                    case CIRCLE -> World3D.flat(sink, pose, x, y, z, e.size * (0.6f + ease * 0.9f), (a << 24) | accent);
                    case WAVE -> World3D.billboard(sink, pose, camera, x, y, z, Fonts.fx('\ue030'),
                            e.size * (1.2f + ease * 2.2f) / 64f, (a << 24) | accent, -32f, -7f);
                    case NUMBER -> {
                        var text = Fonts.hud(e.text);
                        int w = mc.font.width(text);
                        World3D.billboard(sink, pose, camera, x, y + ease * 0.6, z, text, 0.025f, (a << 24) | 0xFF5A6E, -w / 2f, -4f);
                    }
                    case DEATH -> {
                        World3D.flat(sink, pose, x, y + 0.05, z, e.size * (0.5f + ease * 2.5f), (a << 24) | accent);
                        for (int i = 0; i < 10; i++) {
                            float ang = i * Mth.TWO_PI / 10f;
                            double r = e.size * (0.3 + ease * 1.2);
                            World3D.billboard(sink, pose, camera, x + Math.cos(ang) * r, y + 0.2 + ease * 1.6 + (i % 3) * 0.2,
                                    z + Math.sin(ang) * r, Fonts.fx('\ue031'), 0.25f / 64f, (a << 24) | accent, -32f, -7f);
                        }
                    }
                }
                drawn = true;
            }
        }
        return drawn;
    }
}
