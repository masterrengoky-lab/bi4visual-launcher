package net.bi4visual.mod.mixin;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.math.Axis;
import net.bi4visual.mod.Config;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.client.renderer.ItemInHandRenderer;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.util.Mth;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.item.ItemStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.ModifyVariable;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * HMI (1.21.4–1.21.8), our own take on Hold My Items: the held item lags a
 * little behind the view when you turn, breathes slowly while standing, and
 * does not dip down after every hit.
 */
@Mixin(ItemInHandRenderer.class)
public class ItemHandMixin {
    @Unique private static float swayYaw, swayPitch;
    @Unique private static long lastFrame;

    @ModifyVariable(method = "renderArmWithItem", at = @At("HEAD"), argsOnly = true, ordinal = 3, require = 0)
    private float bi4visual$noDip(float equippedProgress) {
        return Config.get().hmi.equals("off") ? equippedProgress : 0f;
    }

    @Inject(method = "renderArmWithItem", at = @At("HEAD"), require = 0)
    private void bi4visual$sway(AbstractClientPlayer player, float partial, float pitch, InteractionHand hand,
                                float swing, ItemStack stack, float equipped, PoseStack pose,
                                MultiBufferSource buffers, int light, CallbackInfo ci) {
        pose.pushPose();
        Config.drawingHand = Config.get().handShader;
        String mode = Config.get().hmi;
        if (mode.equals("off")) return;
        float power = mode.equals("strong") ? 2f : 1f;

        // Follow the view with a delay, once a frame (both hands share it).
        long now = System.nanoTime();
        float yaw = player.getViewYRot(partial), look = player.getViewXRot(partial);
        if (now - lastFrame > 2_000_000L) {
            float dt = Math.min(0.1f, (now - lastFrame) / 1e9f);
            float k = 1f - (float) Math.exp(-dt * 12f);
            if (lastFrame == 0 || Math.abs(Mth.wrapDegrees(yaw - swayYaw)) > 90) {
                swayYaw = yaw;
                swayPitch = look;
            }
            swayYaw += Mth.wrapDegrees(yaw - swayYaw) * k;
            swayPitch += (look - swayPitch) * k;
            lastFrame = now;
        }
        float dYaw = Mth.clamp(Mth.wrapDegrees(yaw - swayYaw), -40, 40);
        float dPitch = Mth.clamp(look - swayPitch, -40, 40);
        float side = hand == InteractionHand.MAIN_HAND ? 1 : -1;

        float t = (now / 1_000_000L % 1_000_000L) / 1000f;
        float breathe = Mth.sin(t * 1.6f) * 0.006f * power;

        pose.translate(-dYaw * 0.0025f * power, dPitch * 0.002f * power + breathe, 0);
        pose.mulPose(Axis.YP.rotationDegrees(dYaw * 0.12f * power));
        pose.mulPose(Axis.ZP.rotationDegrees(dYaw * 0.10f * power * side));
        pose.mulPose(Axis.XP.rotationDegrees(dPitch * 0.10f * power));
    }

    /** Sword size: scales the item itself, right before it is drawn, so it stays in the hand. */
    @Inject(method = "renderArmWithItem", require = 0, at = @At(value = "INVOKE",
            target = "Lnet/minecraft/client/renderer/ItemInHandRenderer;renderItem(Lnet/minecraft/world/entity/LivingEntity;Lnet/minecraft/world/item/ItemStack;Lnet/minecraft/world/item/ItemDisplayContext;ZLcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/MultiBufferSource;I)V"))
    private void bi4visual$swordSize(AbstractClientPlayer player, float partial, float pitch, InteractionHand hand,
                                     float swing, ItemStack stack, float equipped, PoseStack pose,
                                     MultiBufferSource buffers, int light, CallbackInfo ci) {
        int size = Config.get().swordSize;
        if (size == 100 || !BuiltInRegistries.ITEM.getKey(stack.getItem()).getPath().endsWith("_sword")) return;
        float k = size / 100f;
        pose.scale(k, k, k);
    }

    @Inject(method = "renderArmWithItem", at = @At("RETURN"), require = 0)
    private void bi4visual$swayEnd(AbstractClientPlayer player, float partial, float pitch, InteractionHand hand,
                                   float swing, ItemStack stack, float equipped, PoseStack pose,
                                   MultiBufferSource buffers, int light, CallbackInfo ci) {
        Config.drawingHand = false;
        pose.popPose();
    }
}
