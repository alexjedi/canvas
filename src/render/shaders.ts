export const VERTEX = `#version 300 es
in vec2 a_pos;
uniform vec4 u_rect;
uniform mat3 u_matrix;
uniform vec2 u_resolution;
out vec2 v_uv;
out vec2 v_local;
void main() {
  v_uv = a_pos;
  v_local = u_rect.xy + a_pos * u_rect.zw;
  vec2 p = (u_matrix * vec3(v_local, 1.0)).xy;
  vec2 clip = p / u_resolution * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`;

export const TEXTURE_FRAGMENT = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform float u_alpha;
out vec4 color;
void main() {
  color = texture(u_texture, v_uv) * u_alpha;
}`;

export const SOLID_FRAGMENT = `#version 300 es
precision mediump float;
uniform vec4 u_color;
out vec4 color;
void main() {
  color = u_color;
}`;

export const MASK_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_local;
uniform vec2 u_size;
uniform float u_radius;
out vec4 color;
void main() {
  vec2 q = abs(v_local - u_size * 0.5) - u_size * 0.5 + u_radius;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - u_radius;
  if (d > 0.0) discard;
  color = vec4(0.0);
}`;
