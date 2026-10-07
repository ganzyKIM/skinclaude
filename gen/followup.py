# 같은 채팅에서 이어 그릴 때 쓰는 한 줄 프롬프트. usage: python3 followup.py ame_shy
import json, sys
form, key = sys.argv[1].split('_', 1)
plan = json.load(open('plan.json'))
lock = ' '.join('- ' + x for x in plan['lock'][form] + ['pixel-art style with dithered shading and crisp clean outlines'])
print(f"Draw the same character again (same as the references at the start of this chat and your previous images). MUST KEEP IDENTICAL: {lock} | "
      f"RENDERING RULES: - Do NOT draw a white sticker outline or any white border around the character. Apply a soft drop shadow to the whole silhouette instead. No shadow on the ground. "
      f"- Background: completely flat {plan['chroma'][form]} filling the entire frame. No gradient, no texture, no scenery. It will be chroma-keyed out later. | "
      f"COMPOSITION: - A single character only, full body, standing, facing the viewer. Tall portrait, about 400 wide by 658 tall. "
      f"- Her hair ornaments must end well below the top edge and her shoes must end well above the bottom edge. Nothing may touch or cross any edge of the image. | "
      f"CHANGE ONLY THIS: - {plan['variants'][form][key]} | Everything else stays exactly as in the references. Leave the hands empty of props unless the change says otherwise. No text, no watermark.")
