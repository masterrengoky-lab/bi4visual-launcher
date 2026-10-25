package net.bi4visual.mod.mixin;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.math.Axis;
import net.bi4visual.mod.Config;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.entity.ItemEntityRenderer;
import net.minecraft.client.renderer.entity.state.ItemEntityRenderState;
import net.minecraft.world.entity.item.ItemEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** ItemPhysic (1.21.4–1.21.8): dropped items stop bobbing and spinning and lie flat on the ground. */
@Mixin(ItemEntityRenderer.class)
public class ItemPhysicMixin {
    @Inject(method = "extractRenderState(Lnet/minecraft/world/entity/item/ItemEntity;Lnet/minecraft/client/renderer/entity/state/ItemEntityRenderState;F)V",
            at = @At("TAIL"), require = 0)
    private void bi4visual$still(ItemEntity item, ItemEntityRenderState state, float partial, CallbackInfo ci) {
        if (!Config.get().itemPhysic) return;
        // Spin and bob are worked out from these two; a fixed age gives a fixed pose.
        state.ageInTicks = 0;
        state.bobOffset = (item.getId() * 0.37f) % 6.28f;
    }

    @Inject(method = "render(Lnet/minecraft/client/renderer/entity/state/ItemEntityRenderState;Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/MultiBufferSource;I)V",
            at = @At("HEAD"), require = 0)
    private void bi4visual$flat(ItemEntityRenderState state, PoseStack pose, MultiBufferSource buffers, int light, CallbackInfo ci) {
        pose.pushPose();
        if (!Config.get().itemPhysic) return;
        pose.translate(0, -0.1f, 0);
        pose.mulPose(Axis.XP.rotationDegrees(90));
    }

    @Inject(method = "render(Lnet/minecraft/client/renderer/entity/state/ItemEntityRenderState;Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/MultiBufferSource;I)V",
            at = @At("RETURN"), require = 0)
    private void bi4visual$flatEnd(ItemEntityRenderState state, PoseStack pose, MultiBufferSource buffers, int light, CallbackInfo ci) {
        pose.popPose();
    }
}
