package net.bi4visual.mod.mixin;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import net.bi4visual.mod.Config;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.renderer.entity.player.PlayerRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

/**
 * HandGlow (1.21.4–1.21.8): the first-person arm is drawn see-through and
 * tinted, then three slightly bigger copies in the theme colour make a soft halo.
 */
@Mixin(PlayerRenderer.class)
public class HandMixin {
    private static final float[] HALO = {1.08f, 1.16f, 1.26f};

    @Redirect(method = "renderHand", require = 0, at = @At(value = "INVOKE",
            target = "Lnet/minecraft/client/model/geom/ModelPart;render(Lcom/mojang/blaze3d/vertex/PoseStack;Lcom/mojang/blaze3d/vertex/VertexConsumer;II)V"))
    private void bi4visual$glow(ModelPart arm, PoseStack pose, VertexConsumer buffer, int light, int overlay) {
        if (!Config.get().handGlow) {
            arm.render(pose, buffer, light, overlay);
            return;
        }
        int accent = Config.accent() & 0xFFFFFF;
        // The arm itself, see-through and tinted towards the theme colour.
        arm.render(pose, buffer, light, overlay, 0xB0000000 | mix(0xFFFFFF, accent, 0.45f));
        float x = arm.xScale, y = arm.yScale, z = arm.zScale;
        int alpha = 0x30;
        for (float s : HALO) {
            arm.xScale = x * s;
            arm.yScale = y * s;
            arm.zScale = z * s;
            arm.render(pose, buffer, 0xF000F0, overlay, (alpha << 24) | accent);
            alpha -= 0x0C;
        }
        arm.xScale = x;
        arm.yScale = y;
        arm.zScale = z;
    }

    private static int mix(int a, int b, float t) {
        int r = (int) (((a >> 16) & 0xFF) * (1 - t) + ((b >> 16) & 0xFF) * t);
        int g = (int) (((a >> 8) & 0xFF) * (1 - t) + ((b >> 8) & 0xFF) * t);
        int bl = (int) ((a & 0xFF) * (1 - t) + (b & 0xFF) * t);
        return (r << 16) | (g << 8) | bl;
    }
}
