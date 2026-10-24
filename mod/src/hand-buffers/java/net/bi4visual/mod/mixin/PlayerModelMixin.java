package net.bi4visual.mod.mixin;

import java.lang.reflect.Field;
import net.bi4visual.mod.Config;
import net.bi4visual.mod.Modules;
import net.minecraft.client.Minecraft;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.client.renderer.entity.player.PlayerRenderer;
import net.minecraft.client.renderer.entity.state.EntityRenderState;
import net.minecraft.client.renderer.entity.state.PlayerRenderState;
import net.minecraft.client.resources.PlayerSkin;
import net.minecraft.resources.ResourceLocation;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Custom model (1.21.4–1.21.8): only the own player is drawn bigger or smaller
 * and, when asked, with an outline in the theme colour. Nobody else sees it.
 */
@Mixin(PlayerRenderer.class)
public class PlayerModelMixin {
    @Unique private static Field glowing, outline;
    @Unique private static boolean looked;

    @Inject(method = "extractRenderState(Lnet/minecraft/client/player/AbstractClientPlayer;Lnet/minecraft/client/renderer/entity/state/PlayerRenderState;F)V",
            at = @At("TAIL"), require = 0)
    private void bi4visual$model(AbstractClientPlayer player, PlayerRenderState state, float partial, CallbackInfo ci) {
        if (player != Minecraft.getInstance().player) return;
        state.scale *= Modules.modelScale();
        String cape = Config.get().cape;
        if (cape != null && !cape.isEmpty()) {
            ResourceLocation id = ResourceLocation.fromNamespaceAndPath("bi4visual", "textures/cape/" + cape + ".png");
            PlayerSkin s = state.skin;
            state.skin = new PlayerSkin(s.texture(), s.textureUrl(), id, id, s.model(), s.secure());
            state.showCape = true;
        }
        if (!Config.get().outline) return;
        // The outline fields moved between versions, so they are found by name.
        if (!looked) {
            looked = true;
            glowing = field("appearsGlowing");
            outline = field("outlineColor");
        }
        try {
            if (glowing != null && glowing.getType() == boolean.class) glowing.setBoolean(state, true);
            if (outline != null && outline.getType() == int.class) outline.setInt(state, Config.accent() & 0xFFFFFF);
        } catch (ReflectiveOperationException ignored) {
        }
    }

    @Unique
    private static Field field(String name) {
        try {
            Field f = EntityRenderState.class.getField(name);
            f.setAccessible(true);
            return f;
        } catch (ReflectiveOperationException e) {
            return null;
        }
    }
}
