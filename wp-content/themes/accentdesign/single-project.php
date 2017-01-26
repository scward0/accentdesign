<?php if ( have_posts() ) : while ( have_posts() ) : the_post(); ?>
  <?php if( get_the_post_thumbnail() ) : ?>
    <div class="container">
      <div style="background: url('<?php the_post_thumbnail_url(); ?>');  height: 100%; background-attachment: fixed; background-position: center; background-repeat: no-repeat;  background-size: cover;">
        <?php get_header(); ?>
        <div class="headline">
          <h1 class="text-center" style="color: white; text-transform: uppercase;"><?php the_title(); ?></h1>
          <div class="description" style="text-align: left;">
            <?php the_field('description'); ?>
          </div>

          <div class="navigation">
            <p class="prev-post" style="color: white; position: absolute; left: -30%;">
              <?php previous_post_link(); ?>
            </p>
            <p class="next-post" style="color: white; position: absolute; right: -30%;">
              <?php next_post_link(); ?>
            </p>
          </div>
        </div>
        <div class="arrow">
          <img src="http://redirectdevhosting.com/wp-content/uploads/2016/12/arrow-down@2x.png"  width="100px" alt="Arrow Down" style="position: absolute; top: 90%; left: 50%; transform: translateX(-50%) translateY(-50%);" />
        </div>
      </div>
    </div>
    <div class="container" style="background: #4d4d4d;">
      <div class="row text-center" style="padding: 8%; color: white;">
        <?php  the_field('comment'); ?><br>
        <?php the_field('client'); ?><br>
        <?php the_field('client_location'); ?>
      </div>
    </div>
    <div class="container">
      <br><br>
      <p class="text-center" style="font-size: 32px; font-weight: bold;">
        GALLERY
      </p>
      <div class="row">
      <?php
        // check if the repeater field has rows of data
        if( have_rows('gallery') ): $i = 0;
          // loop through the rows of data
            while ( have_rows('gallery') ) : the_row();
            $i++;
            ?>
            <div class="columns small-12 large-6">
              <a href="#" data-reveal-id="image-<?php echo $i ?>" >
                <img src="<?php the_sub_field('image');?>" alt="" style="padding: 5px;"/>
              </a>
              <div class="text-center">
                <div id="image-<?php echo $i ?>" class="reveal-modal" data-reveal aria-labelledby="modalTitle" aria-hidden="true" role="dialog" style="width: auto;">
                  <img src="<?php the_sub_field('image');?>" width="500px" alt="" style="display: block; margin-left: auto; margin-right: auto; padding: 20px;" />
                  <a class="close-reveal-modal" aria-label="Close">&#215;</a>
                </div>
              </div>
            </div>
            <?php
            endwhile;
        endif;
        ?>
      </div>
    </div>

  <?php endif; ?>

<?php endwhile; else : ?>

  <p><?php _e( 'Sorry, no pages found' ); ?></p>

<?php endif; ?>

<?php get_footer(); ?>
